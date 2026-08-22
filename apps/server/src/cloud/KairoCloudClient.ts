import {
  DEFAULT_KAIRO_CLOUD_API_URL,
  KairoCloudCapabilitiesResponse,
  type KairoCloudCapabilitiesResponse as KairoCloudCapabilitiesResponseShape,
  type KairoCloudInstallationExchangeRequest,
  KairoCloudInstallationExchangeResponse,
  type KairoCloudInstallationExchangeResponse as KairoCloudInstallationExchangeResponseShape,
  type KairoCloudMemoryContextRequest,
  KairoCloudMemoryContextResponse,
  type KairoCloudMemoryContextResponse as KairoCloudMemoryContextResponseShape,
  type KairoCloudMemoryRecallRequest,
  KairoCloudMemoryRecallResponse,
  type KairoCloudMemoryRecallResponse as KairoCloudMemoryRecallResponseShape,
  type KairoCloudMemorySaveRequest,
  KairoCloudMemorySaveResponse,
  type KairoCloudMemorySaveResponse as KairoCloudMemorySaveResponseShape,
  SupermemoryError,
} from "@kairo/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

export interface KairoCloudClientShape {
  readonly exchangeInstallationGrant: (
    clerkToken: Redacted.Redacted<string>,
    input: KairoCloudInstallationExchangeRequest,
  ) => Effect.Effect<KairoCloudInstallationExchangeResponseShape, SupermemoryError>;
  readonly getCapabilities: (
    accessToken: Redacted.Redacted<string>,
  ) => Effect.Effect<KairoCloudCapabilitiesResponseShape, SupermemoryError>;
  readonly saveMemory: (
    accessToken: Redacted.Redacted<string>,
    input: KairoCloudMemorySaveRequest,
  ) => Effect.Effect<KairoCloudMemorySaveResponseShape, SupermemoryError>;
  readonly recallMemory: (
    accessToken: Redacted.Redacted<string>,
    input: KairoCloudMemoryRecallRequest,
  ) => Effect.Effect<KairoCloudMemoryRecallResponseShape, SupermemoryError>;
  readonly getMemoryContext: (
    accessToken: Redacted.Redacted<string>,
    input: KairoCloudMemoryContextRequest,
  ) => Effect.Effect<KairoCloudMemoryContextResponseShape, SupermemoryError>;
}

export class KairoCloudClient extends Context.Service<KairoCloudClient, KairoCloudClientShape>()(
  "kairo/cloud/KairoCloudClient",
) {}

const apiUrlConfig = Config.string("KAIRO_CLOUD_API_URL").pipe(
  Config.withDefault(DEFAULT_KAIRO_CLOUD_API_URL),
);

function requestError(operation: string, message: string, cause?: unknown): SupermemoryError {
  return new SupermemoryError({
    message: `Kairo Cloud ${operation} failed: ${message}`,
    ...(cause === undefined ? {} : { cause }),
  });
}

export const makeKairoCloudClient = Effect.gen(function* () {
  const configuredApiUrl = yield* apiUrlConfig;
  const baseUrl = yield* Effect.try({
    try: () => new URL(configuredApiUrl),
    catch: (cause) => requestError("configuration", "KAIRO_CLOUD_API_URL is invalid.", cause),
  });
  const httpClient = yield* HttpClient.HttpClient;

  const execute = Effect.fn("KairoCloudClient.execute")(function* <A>(input: {
    readonly accessToken: Redacted.Redacted<string>;
    readonly method: "GET" | "POST";
    readonly operation: string;
    readonly path: string;
    readonly body?: unknown;
    readonly responseSchema: Schema.Decoder<A>;
  }) {
    const url = new URL(input.path, baseUrl).toString();
    const request = (
      input.method === "GET" ? HttpClientRequest.get(url) : HttpClientRequest.post(url)
    ).pipe(
      HttpClientRequest.bearerToken(Redacted.value(input.accessToken)),
      HttpClientRequest.acceptJson,
      input.body === undefined ? (value) => value : HttpClientRequest.bodyJsonUnsafe(input.body),
    );
    const response = yield* httpClient.execute(request).pipe(
      Effect.timeout("10 seconds"),
      Effect.mapError((cause) => requestError(input.operation, "service is unreachable.", cause)),
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* requestError(
        input.operation,
        response.status === 401 || response.status === 403
          ? "access grant is invalid or expired."
          : `service returned HTTP ${response.status}.`,
      );
    }
    return yield* HttpClientResponse.schemaBodyJson(input.responseSchema)(response).pipe(
      Effect.mapError((cause) =>
        requestError(input.operation, "service returned an invalid response.", cause),
      ),
    );
  });

  return KairoCloudClient.of({
    exchangeInstallationGrant: (clerkToken, body) =>
      execute({
        accessToken: clerkToken,
        method: "POST",
        operation: "access provisioning",
        path: "/v1/installations/exchange",
        body,
        responseSchema: KairoCloudInstallationExchangeResponse,
      }),
    getCapabilities: (accessToken) =>
      execute({
        accessToken,
        method: "GET",
        operation: "capabilities check",
        path: "/v1/capabilities",
        responseSchema: KairoCloudCapabilitiesResponse,
      }),
    saveMemory: (accessToken, body) =>
      execute({
        accessToken,
        method: "POST",
        operation: "memory save",
        path: "/v1/memory/save",
        body,
        responseSchema: KairoCloudMemorySaveResponse,
      }),
    recallMemory: (accessToken, body) =>
      execute({
        accessToken,
        method: "POST",
        operation: "memory recall",
        path: "/v1/memory/recall",
        body,
        responseSchema: KairoCloudMemoryRecallResponse,
      }),
    getMemoryContext: (accessToken, body) =>
      execute({
        accessToken,
        method: "POST",
        operation: "memory context",
        path: "/v1/memory/context",
        body,
        responseSchema: KairoCloudMemoryContextResponse,
      }),
  });
});

export const layer = Layer.effect(KairoCloudClient, makeKairoCloudClient);
