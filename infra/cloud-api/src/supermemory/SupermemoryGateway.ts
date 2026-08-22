import {
  KairoCloudMemoryContextResponse,
  type KairoCloudMemoryContextRequest,
  type KairoCloudMemoryContextResponse as KairoCloudMemoryContextResponseType,
  KairoCloudMemoryRecallResponse,
  type KairoCloudMemoryRecallRequest,
  type KairoCloudMemoryRecallResponse as KairoCloudMemoryRecallResponseType,
  KairoCloudMemorySaveResponse,
  type KairoCloudMemorySaveRequest,
  type KairoCloudMemorySaveResponse as KairoCloudMemorySaveResponseType,
} from "@kairo/contracts/cloud";
import * as NodeCrypto from "node:crypto";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/unstable/http";

import { CloudApiConfiguration } from "../Config.ts";
import { CloudApiRequestFailure } from "../Errors.ts";

type GatewayRequest = {
  readonly requestId: string;
  readonly memoryNamespace: string;
};

export class SupermemoryGateway extends Context.Service<
  SupermemoryGateway,
  {
    readonly save: (
      input: GatewayRequest & KairoCloudMemorySaveRequest,
    ) => Effect.Effect<KairoCloudMemorySaveResponseType, CloudApiRequestFailure>;
    readonly recall: (
      input: GatewayRequest & KairoCloudMemoryRecallRequest,
    ) => Effect.Effect<KairoCloudMemoryRecallResponseType, CloudApiRequestFailure>;
    readonly context: (
      input: GatewayRequest & KairoCloudMemoryContextRequest,
    ) => Effect.Effect<KairoCloudMemoryContextResponseType, CloudApiRequestFailure>;
  }
>()("kairo-cloud-api/supermemory/SupermemoryGateway") {}

const decodeSaveResponse = Schema.decodeUnknownEffect(KairoCloudMemorySaveResponse);
const decodeRecallResponse = Schema.decodeUnknownEffect(KairoCloudMemoryRecallResponse);
const decodeContextResponse = Schema.decodeUnknownEffect(KairoCloudMemoryContextResponse);

function deriveContainerTag(configuration: CloudApiConfiguration["Service"], namespace: string) {
  const digest = NodeCrypto.createHmac("sha256", Redacted.value(configuration.namespaceHmacKey))
    .update(namespace)
    .digest("base64url");
  return `kairo_v1_${digest}`;
}

function upstreamFailure(input: {
  readonly requestId: string;
  readonly code: "rate_limited" | "upstream_rejected" | "upstream_unavailable";
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

function validateUpstreamStatus(
  requestId: string,
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<HttpClientResponse.HttpClientResponse, CloudApiRequestFailure> {
  if (response.status >= 200 && response.status < 300) return Effect.succeed(response);
  if (response.status === 429) {
    return Effect.fail(
      upstreamFailure({
        requestId,
        code: "rate_limited",
        status: 429,
        message: "Memory service rate limit reached.",
      }),
    );
  }
  if (response.status >= 500) {
    return Effect.fail(
      upstreamFailure({
        requestId,
        code: "upstream_unavailable",
        status: 503,
        message: "Memory provider is unavailable.",
      }),
    );
  }
  return Effect.fail(
    upstreamFailure({
      requestId,
      code: "upstream_rejected",
      status: 502,
      message: "Memory provider rejected request.",
    }),
  );
}

const makeGateway = Effect.gen(function* () {
  const configuration = yield* CloudApiConfiguration;
  const httpClient = yield* HttpClient.HttpClient;

  const execute = Effect.fn("cloudApi.supermemory.execute")(function* (input: {
    readonly requestId: string;
    readonly path: "/v3/documents" | "/v4/search" | "/v4/profile";
    readonly body: unknown;
  }) {
    const url = new URL(input.path, configuration.supermemoryApiUrl).toString();
    const response = yield* httpClient
      .execute(
        HttpClientRequest.post(url).pipe(
          HttpClientRequest.bearerToken(Redacted.value(configuration.supermemoryApiKey)),
          HttpClientRequest.acceptJson,
          HttpClientRequest.bodyJsonUnsafe(input.body),
        ),
      )
      .pipe(
        Effect.mapError(() =>
          upstreamFailure({
            requestId: input.requestId,
            code: "upstream_unavailable",
            status: 503,
            message: "Memory provider is unavailable.",
          }),
        ),
        Effect.timeoutOrElse({
          duration: "8 seconds",
          orElse: () =>
            Effect.fail(
              CloudApiRequestFailure.make({
                requestId: input.requestId,
                code: "request_timeout",
                safeMessage: "Memory provider request timed out.",
                status: 504,
              }),
            ),
        }),
        Effect.flatMap((value) => validateUpstreamStatus(input.requestId, value)),
      );
    return yield* response.json.pipe(
      Effect.mapError(() =>
        upstreamFailure({
          requestId: input.requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "Memory provider returned invalid JSON.",
        }),
      ),
    );
  });

  const save: SupermemoryGateway["Service"]["save"] = Effect.fn("cloudApi.supermemory.save")(
    function* (input) {
      const result = yield* execute({
        requestId: input.requestId,
        path: "/v3/documents",
        body: {
          content: input.content,
          containerTag: deriveContainerTag(configuration, input.memoryNamespace),
        },
      });
      return yield* decodeSaveResponse(result).pipe(
        Effect.mapError(() =>
          upstreamFailure({
            requestId: input.requestId,
            code: "upstream_unavailable",
            status: 503,
            message: "Memory provider returned invalid save response.",
          }),
        ),
      );
    },
  );

  const recall: SupermemoryGateway["Service"]["recall"] = Effect.fn("cloudApi.supermemory.recall")(
    function* (input) {
      const result = yield* execute({
        requestId: input.requestId,
        path: "/v4/search",
        body: {
          q: input.query,
          limit: input.limit ?? 10,
          containerTag: deriveContainerTag(configuration, input.memoryNamespace),
        },
      });
      return yield* decodeRecallResponse(result).pipe(
        Effect.mapError(() =>
          upstreamFailure({
            requestId: input.requestId,
            code: "upstream_unavailable",
            status: 503,
            message: "Memory provider returned invalid recall response.",
          }),
        ),
      );
    },
  );

  const context: SupermemoryGateway["Service"]["context"] = Effect.fn(
    "cloudApi.supermemory.context",
  )(function* (input) {
    const result = yield* execute({
      requestId: input.requestId,
      path: "/v4/profile",
      body: {
        containerTag: deriveContainerTag(configuration, input.memoryNamespace),
        ...(input.query ? { q: input.query } : {}),
      },
    });
    return yield* decodeContextResponse(result).pipe(
      Effect.mapError(() =>
        upstreamFailure({
          requestId: input.requestId,
          code: "upstream_unavailable",
          status: 503,
          message: "Memory provider returned invalid context response.",
        }),
      ),
    );
  });

  return SupermemoryGateway.of({ save, recall, context });
});

export const layer = Layer.effect(SupermemoryGateway, makeGateway);
