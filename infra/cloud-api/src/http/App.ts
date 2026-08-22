import {
  KAIRO_CLOUD_REQUEST_BODY_MAX_BYTES,
  KairoCloudErrorResponse,
  KairoCloudInstallationExchangeRequest,
  KairoCloudMemoryContextRequest,
  KairoCloudMemoryRecallRequest,
  KairoCloudMemorySaveRequest,
  type KairoCloudScope,
} from "@kairo/contracts/cloud";
import * as NodeCrypto from "node:crypto";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";

import * as CloudApiConfig from "../Config.ts";
import { CloudApiRequestFailure } from "../Errors.ts";
import * as ClerkSession from "../auth/ClerkSession.ts";
import * as InstallationGrant from "../auth/InstallationGrant.ts";
import * as Supermemory from "../supermemory/SupermemoryGateway.ts";

const decodeSaveRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(KairoCloudMemorySaveRequest),
);
const decodeRecallRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(KairoCloudMemoryRecallRequest),
);
const decodeContextRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(KairoCloudMemoryContextRequest),
);
const decodeInstallationExchangeRequest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(KairoCloudInstallationExchangeRequest),
);
const decodeErrorResponse = Schema.decodeUnknownSync(KairoCloudErrorResponse);

function responseJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function errorResponse(error: CloudApiRequestFailure): Response {
  const body = decodeErrorResponse({
    requestId: error.requestId,
    code: error.code,
    message: error.safeMessage,
    ...(error.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: error.retryAfterSeconds }),
  });
  return responseJson(body, error.status);
}

function normalizePathname(url: URL): string {
  const rewrittenPath = url.pathname === "/api/v1" ? url.searchParams.get("__kairo_path") : null;
  if (rewrittenPath) {
    return `/v1/${rewrittenPath.replace(/^\/+/, "")}`;
  }
  return url.pathname === "/api"
    ? "/"
    : url.pathname.startsWith("/api/")
      ? url.pathname.slice(4)
      : url.pathname;
}

function requestIdFrom(request: Request): string {
  const supplied = request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id");
  return supplied && supplied.length <= 128
    ? supplied
    : `local_${NodeCrypto.randomBytes(12).toString("hex")}`;
}

function requestFailure(input: {
  readonly requestId: string;
  readonly code: "auth_invalid" | "request_invalid" | "internal";
  readonly message: string;
  readonly status: number;
}) {
  return CloudApiRequestFailure.make({
    requestId: input.requestId,
    code: input.code,
    safeMessage: input.message,
    status: input.status,
  });
}

function readBearerToken(
  request: Request,
  requestId: string,
): Effect.Effect<string, CloudApiRequestFailure> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Effect.fail(
      requestFailure({
        requestId,
        code: "auth_invalid",
        message: "Kairo Cloud authentication failed.",
        status: 401,
      }),
    );
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0
    ? Effect.succeed(token)
    : Effect.fail(
        requestFailure({
          requestId,
          code: "auth_invalid",
          message: "Kairo Cloud authentication failed.",
          status: 401,
        }),
      );
}

const readBody = Effect.fn("cloudApi.http.readBody")(function* <A, E>(input: {
  readonly request: Request;
  readonly requestId: string;
  readonly decode: (body: string) => Effect.Effect<A, E>;
}) {
  const contentLength = input.request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > KAIRO_CLOUD_REQUEST_BODY_MAX_BYTES) {
    return yield* requestFailure({
      requestId: input.requestId,
      code: "request_invalid",
      message: "Request body is too large.",
      status: 400,
    });
  }
  const body = yield* Effect.tryPromise({
    try: () => input.request.text(),
    catch: () =>
      requestFailure({
        requestId: input.requestId,
        code: "request_invalid",
        message: "Request body is invalid.",
        status: 400,
      }),
  });
  if (new TextEncoder().encode(body).byteLength > KAIRO_CLOUD_REQUEST_BODY_MAX_BYTES) {
    return yield* requestFailure({
      requestId: input.requestId,
      code: "request_invalid",
      message: "Request body is too large.",
      status: 400,
    });
  }
  return yield* input.decode(body).pipe(
    Effect.mapError(() =>
      requestFailure({
        requestId: input.requestId,
        code: "request_invalid",
        message: "Request body is invalid.",
        status: 400,
      }),
    ),
  );
});

function requireScope(
  scopes: ReadonlySet<KairoCloudScope>,
  scope: KairoCloudScope,
  requestId: string,
): Effect.Effect<void, CloudApiRequestFailure> {
  return scopes.has(scope)
    ? Effect.void
    : Effect.fail(
        requestFailure({
          requestId,
          code: "auth_invalid",
          message: "Kairo Cloud request is not authorized.",
          status: 403,
        }),
      );
}

export const handleCloudApiRequest = Effect.fn("cloudApi.http.handleRequest")(function* (
  request: Request,
) {
  const requestId = requestIdFrom(request);
  const pathname = normalizePathname(new URL(request.url));
  if (request.method === "GET" && pathname === "/health") {
    return responseJson({ ok: true, service: "kairo-cloud-api", version: "1" });
  }

  const verifier = yield* InstallationGrant.InstallationGrantVerifier;
  const token = yield* readBearerToken(request, requestId);

  if (request.method === "POST" && pathname === "/v1/installations/exchange") {
    const configuration = yield* CloudApiConfig.CloudApiConfiguration;
    const clerk = yield* ClerkSession.ClerkSessionVerifier;
    const session = yield* clerk.verify(token).pipe(
      Effect.mapError(() =>
        requestFailure({
          requestId,
          code: "auth_invalid",
          message: "Kairo account authentication failed.",
          status: 401,
        }),
      ),
    );
    const payload = yield* readBody({
      request,
      requestId,
      decode: decodeInstallationExchangeRequest,
    });
    const issuedAtEpochSeconds = Math.floor((yield* Clock.currentTimeMillis) / 1_000);
    const expiresAtEpochSeconds = issuedAtEpochSeconds + 30 * 24 * 60 * 60;
    const memoryNamespace = NodeCrypto.createHmac(
      "sha256",
      Redacted.value(configuration.namespaceHmacKey),
    )
      .update(`clerk-user:v1\0${session.subjectId}`)
      .digest("base64url");
    const accessToken = yield* InstallationGrant.issueInstallationGrant({
      privateKey: Redacted.value(configuration.tokenPrivateKey),
      issuer: configuration.tokenIssuer,
      subjectId: `environment:${payload.environmentId}`,
      tokenId: NodeCrypto.randomUUID(),
      memoryNamespace,
      scopes: ["memory:read", "memory:write"],
      issuedAtEpochSeconds,
      expiresAtEpochSeconds,
    }).pipe(
      Effect.mapError(() =>
        requestFailure({
          requestId,
          code: "internal",
          message: "Kairo Cloud access could not be provisioned.",
          status: 500,
        }),
      ),
    );
    return responseJson({ accessToken, expiresAtEpochSeconds });
  }

  const principal = yield* verifier.verify(token).pipe(
    Effect.mapError(() =>
      requestFailure({
        requestId,
        code: "auth_invalid",
        message: "Kairo Cloud authentication failed.",
        status: 401,
      }),
    ),
  );

  if (request.method === "GET" && pathname === "/v1/capabilities") {
    return responseJson({ memory: true, principal: "installation" });
  }

  const gateway = yield* Supermemory.SupermemoryGateway;
  if (request.method === "POST" && pathname === "/v1/memory/save") {
    yield* requireScope(principal.scopes, "memory:write", requestId);
    const payload = yield* readBody({ request, requestId, decode: decodeSaveRequest });
    return responseJson(
      yield* gateway.save({
        requestId,
        memoryNamespace: principal.memoryNamespace,
        ...payload,
      }),
    );
  }
  if (request.method === "POST" && pathname === "/v1/memory/recall") {
    yield* requireScope(principal.scopes, "memory:read", requestId);
    const payload = yield* readBody({ request, requestId, decode: decodeRecallRequest });
    return responseJson(
      yield* gateway.recall({
        requestId,
        memoryNamespace: principal.memoryNamespace,
        ...payload,
      }),
    );
  }
  if (request.method === "POST" && pathname === "/v1/memory/context") {
    yield* requireScope(principal.scopes, "memory:read", requestId);
    const payload = yield* readBody({ request, requestId, decode: decodeContextRequest });
    return responseJson(
      yield* gateway.context({
        requestId,
        memoryNamespace: principal.memoryNamespace,
        ...payload,
      }),
    );
  }

  return yield* requestFailure({
    requestId,
    code: "request_invalid",
    message: "Route not found.",
    status: 404,
  });
});

const handleCloudApiRequestSafely = (request: Request) =>
  handleCloudApiRequest(request).pipe(
    Effect.catch((error) => Effect.succeed(errorResponse(error))),
    Effect.catchDefect(() =>
      Effect.succeed(
        errorResponse(
          requestFailure({
            requestId: requestIdFrom(request),
            code: "internal",
            message: "Kairo Cloud request failed.",
            status: 500,
          }),
        ),
      ),
    ),
  );

export function makeCloudApiHandler(
  configuration: CloudApiConfig.CloudApiConfigurationShape,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
  clerkSessionVerifier?: ClerkSession.ClerkSessionVerifier["Service"],
) {
  const httpLayer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchImplementation)),
  );
  const clerkSessionLayer = clerkSessionVerifier
    ? Layer.succeed(ClerkSession.ClerkSessionVerifier, clerkSessionVerifier)
    : ClerkSession.layer;
  const runtimeLayer = Layer.mergeAll(
    InstallationGrant.layer,
    Supermemory.layer,
    clerkSessionLayer,
  ).pipe(Layer.provideMerge(CloudApiConfig.layer(configuration)), Layer.provideMerge(httpLayer));
  const runtime = ManagedRuntime.make(runtimeLayer);
  return {
    handler: (request: Request) => runtime.runPromise(handleCloudApiRequestSafely(request)),
    dispose: () => runtime.dispose(),
  };
}
