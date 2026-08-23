import { KAIRO_CLOUD_COMPOSIO_REQUEST_BODY_MAX_BYTES } from "@kairo/contracts/cloud";
import * as NodeCrypto from "node:crypto";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";

import { CloudApiConfiguration } from "../Config.ts";
import { CloudApiRequestFailure } from "../Errors.ts";

const NonEmptyString = Schema.String.check(Schema.isNonEmpty());
const ComposioSessionResponse = Schema.Struct({
  session_id: NonEmptyString,
  mcp: Schema.Struct({
    url: Schema.URLFromString,
  }),
});
const TransportState = Schema.Struct({
  version: Schema.Literal(1),
  url: Schema.URLFromString,
  upstreamSessionId: Schema.optionalKey(NonEmptyString),
});
const InitializeRequest = Schema.Struct({ method: Schema.Literal("initialize") });
const ComposioSessionRequest = Schema.Struct({ user_id: NonEmptyString });

const decodeSessionResponse = Schema.decodeUnknownEffect(ComposioSessionResponse);
const decodeTransportState = Schema.decodeUnknownEffect(Schema.fromJsonString(TransportState));
const decodeInitializeRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(InitializeRequest),
);
const encodeTransportStateJson = Schema.encodeSync(Schema.fromJsonString(TransportState));
const encodeComposioSessionRequest = Schema.encodeSync(
  Schema.fromJsonString(ComposioSessionRequest),
);

function failure(input: {
  readonly requestId: string;
  readonly code: "request_invalid" | "upstream_rejected" | "upstream_unavailable";
  readonly status: number;
  readonly message: string;
}) {
  return CloudApiRequestFailure.make({
    requestId: input.requestId,
    code: input.code,
    safeMessage: input.message,
    status: input.status,
  });
}

function isComposioUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    (url.hostname === "composio.dev" || url.hostname.endsWith(".composio.dev"))
  );
}

function transportEncryptionKey(configuration: CloudApiConfiguration["Service"]): Buffer {
  return NodeCrypto.createHash("sha256")
    .update("composio-mcp-transport:v1\0")
    .update(Redacted.value(configuration.namespaceHmacKey))
    .digest();
}

function encodeTransportState(
  configuration: CloudApiConfiguration["Service"],
  accountNamespace: string,
  state: typeof TransportState.Type,
): string {
  const nonce = NodeCrypto.randomBytes(12);
  const cipher = NodeCrypto.createCipheriv(
    "aes-256-gcm",
    transportEncryptionKey(configuration),
    nonce,
  );
  cipher.setAAD(Buffer.from(accountNamespace));
  const ciphertext = Buffer.concat([
    cipher.update(encodeTransportStateJson(state), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return `v1.${nonce.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

const decodeTransportToken = Effect.fn("cloudApi.composio.decodeTransportToken")(function* (
  configuration: CloudApiConfiguration["Service"],
  accountNamespace: string,
  token: string,
  requestId: string,
) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || token.length > 4_096) {
    return yield* failure({
      requestId,
      code: "request_invalid",
      status: 400,
      message: "Composio session is invalid.",
    });
  }
  const json = yield* Effect.try({
    try: () => {
      const nonce = Buffer.from(parts[1] ?? "", "base64url");
      const encrypted = Buffer.from(parts[2] ?? "", "base64url");
      if (nonce.length !== 12 || encrypted.length <= 16) throw new Error("invalid token");
      const decipher = NodeCrypto.createDecipheriv(
        "aes-256-gcm",
        transportEncryptionKey(configuration),
        nonce,
      );
      decipher.setAAD(Buffer.from(accountNamespace));
      decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
      return Buffer.concat([
        decipher.update(encrypted.subarray(0, encrypted.length - 16)),
        decipher.final(),
      ]).toString("utf8");
    },
    catch: () =>
      failure({
        requestId,
        code: "request_invalid",
        status: 400,
        message: "Composio session is invalid.",
      }),
  });
  const state = yield* decodeTransportState(json).pipe(
    Effect.mapError(() =>
      failure({
        requestId,
        code: "request_invalid",
        status: 400,
        message: "Composio session is invalid.",
      }),
    ),
  );
  if (!isComposioUrl(state.url)) {
    return yield* failure({
      requestId,
      code: "request_invalid",
      status: 400,
      message: "Composio session is invalid.",
    });
  }
  return state;
});

export class ComposioGateway extends Context.Service<
  ComposioGateway,
  {
    readonly proxy: (input: {
      readonly request: Request;
      readonly requestId: string;
      readonly accountNamespace: string;
    }) => Effect.Effect<Response, CloudApiRequestFailure>;
  }
>()("kairo-cloud-api/composio/ComposioGateway") {}

const makeGateway = Effect.gen(function* () {
  const configuration = yield* CloudApiConfiguration;
  const fetch = yield* FetchHttpClient.Fetch;

  const createSession = Effect.fn("cloudApi.composio.createSession")(function* (
    requestId: string,
    accountNamespace: string,
  ) {
    const apiKey = configuration.composioApiKey;
    if (apiKey === null) {
      return yield* failure({
        requestId,
        code: "upstream_unavailable",
        status: 503,
        message: "App integration service is unavailable.",
      });
    }
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL("/api/v3.1/tool_router/session", configuration.composioApiUrl), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": Redacted.value(apiKey),
          },
          body: encodeComposioSessionRequest({ user_id: `kairo_${accountNamespace}` }),
        }),
      catch: () =>
        failure({
          requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "App integration service is unavailable.",
        }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: "8 seconds",
        orElse: () =>
          Effect.fail(
            failure({
              requestId,
              code: "upstream_unavailable",
              status: 503,
              message: "App integration service is unavailable.",
            }),
          ),
      }),
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* failure({
        requestId,
        code: response.status >= 500 ? "upstream_unavailable" : "upstream_rejected",
        status: response.status >= 500 ? 503 : 502,
        message: "App integration service rejected session setup.",
      });
    }
    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        failure({
          requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "App integration service returned an invalid session.",
        }),
    });
    const session = yield* decodeSessionResponse(body).pipe(
      Effect.mapError(() =>
        failure({
          requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "App integration service returned an invalid session.",
        }),
      ),
    );
    if (!isComposioUrl(session.mcp.url)) {
      return yield* failure({
        requestId,
        code: "upstream_unavailable",
        status: 503,
        message: "App integration service returned an invalid session.",
      });
    }
    return { version: 1 as const, url: session.mcp.url };
  });

  const readBody = Effect.fn("cloudApi.composio.readBody")(function* (
    request: Request,
    requestId: string,
  ) {
    const contentLength = request.headers.get("content-length");
    if (
      contentLength !== null &&
      Number(contentLength) > KAIRO_CLOUD_COMPOSIO_REQUEST_BODY_MAX_BYTES
    ) {
      return yield* failure({
        requestId,
        code: "request_invalid",
        status: 400,
        message: "Composio request body is too large.",
      });
    }
    const body = yield* Effect.tryPromise({
      try: () => request.arrayBuffer(),
      catch: () =>
        failure({
          requestId,
          code: "request_invalid",
          status: 400,
          message: "Composio request body is invalid.",
        }),
    });
    if (body.byteLength > KAIRO_CLOUD_COMPOSIO_REQUEST_BODY_MAX_BYTES) {
      return yield* failure({
        requestId,
        code: "request_invalid",
        status: 400,
        message: "Composio request body is too large.",
      });
    }
    return new Uint8Array(body);
  });

  const proxy: ComposioGateway["Service"]["proxy"] = Effect.fn("cloudApi.composio.proxy")(
    function* ({ request, requestId, accountNamespace }) {
      if (configuration.composioApiKey === null) {
        return yield* failure({
          requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "App integration service is unavailable.",
        });
      }
      if (request.method !== "POST" && request.method !== "GET" && request.method !== "DELETE") {
        return yield* failure({
          requestId,
          code: "request_invalid",
          status: 405,
          message: "Composio request method is not supported.",
        });
      }
      const body = request.method === "POST" ? yield* readBody(request, requestId) : undefined;
      const transportToken = request.headers.get("mcp-session-id");
      const state: typeof TransportState.Type = transportToken
        ? yield* decodeTransportToken(configuration, accountNamespace, transportToken, requestId)
        : yield* Effect.gen(function* () {
            if (request.method !== "POST" || body === undefined) {
              return yield* failure({
                requestId,
                code: "request_invalid",
                status: 400,
                message: "Composio session is required.",
              });
            }
            yield* decodeInitializeRequest(new TextDecoder().decode(body)).pipe(
              Effect.mapError(() =>
                failure({
                  requestId,
                  code: "request_invalid",
                  status: 400,
                  message: "Composio session must start with initialize.",
                }),
              ),
            );
            return yield* createSession(requestId, accountNamespace);
          });

      const headers = new Headers({
        accept: request.headers.get("accept") ?? "application/json, text/event-stream",
        "x-api-key": Redacted.value(configuration.composioApiKey),
      });
      const contentType = request.headers.get("content-type");
      const protocolVersion = request.headers.get("mcp-protocol-version");
      const lastEventId = request.headers.get("last-event-id");
      if (contentType) headers.set("content-type", contentType);
      if (protocolVersion) headers.set("mcp-protocol-version", protocolVersion);
      if (lastEventId) headers.set("last-event-id", lastEventId);
      if (state.upstreamSessionId) headers.set("mcp-session-id", state.upstreamSessionId);

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(state.url, {
            method: request.method,
            headers,
            ...(body === undefined ? {} : { body }),
          }),
        catch: () =>
          failure({
            requestId,
            code: "upstream_unavailable",
            status: 503,
            message: "App integration service is unavailable.",
          }),
      });
      const responseHeaders = new Headers();
      for (const name of ["cache-control", "content-type", "retry-after"]) {
        const value = response.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      const nextState = {
        ...state,
        ...(response.headers.get("mcp-session-id")
          ? { upstreamSessionId: response.headers.get("mcp-session-id")! }
          : {}),
      };
      responseHeaders.set(
        "mcp-session-id",
        encodeTransportState(configuration, accountNamespace, nextState),
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    },
  );

  return ComposioGateway.of({ proxy });
});

export const layer = Layer.effect(ComposioGateway, makeGateway);
