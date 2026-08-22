import * as Context from "effect/Context";
import * as Schema from "effect/Schema";

import { EnvironmentId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const DEFAULT_KAIRO_CLOUD_API_URL = "https://kairo-cloud-api.vercel.app";

export const KAIRO_CLOUD_MEMORY_CONTENT_MAX_CHARS = 65_536;
export const KAIRO_CLOUD_MEMORY_QUERY_MAX_CHARS = 4_096;
export const KAIRO_CLOUD_REQUEST_BODY_MAX_BYTES = 98_304;

export const KairoCloudScope = Schema.Literals(["memory:read", "memory:write"]);
export type KairoCloudScope = typeof KairoCloudScope.Type;

export const KairoCloudMemorySaveRequest = Schema.Struct({
  content: Schema.String.check(
    Schema.isNonEmpty(),
    Schema.isMaxLength(KAIRO_CLOUD_MEMORY_CONTENT_MAX_CHARS),
  ),
});
export type KairoCloudMemorySaveRequest = typeof KairoCloudMemorySaveRequest.Type;

export const KairoCloudMemoryRecallRequest = Schema.Struct({
  query: Schema.String.check(
    Schema.isNonEmpty(),
    Schema.isMaxLength(KAIRO_CLOUD_MEMORY_QUERY_MAX_CHARS),
  ),
  limit: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(50)),
  ),
});
export type KairoCloudMemoryRecallRequest = typeof KairoCloudMemoryRecallRequest.Type;

export const KairoCloudMemoryContextRequest = Schema.Struct({
  query: Schema.optionalKey(
    Schema.String.check(
      Schema.isNonEmpty(),
      Schema.isMaxLength(KAIRO_CLOUD_MEMORY_QUERY_MAX_CHARS),
    ),
  ),
});
export type KairoCloudMemoryContextRequest = typeof KairoCloudMemoryContextRequest.Type;

export const KairoCloudHealthResponse = Schema.Struct({
  ok: Schema.Literal(true),
  service: Schema.Literal("kairo-cloud-api"),
  version: Schema.Literal("1"),
});
export type KairoCloudHealthResponse = typeof KairoCloudHealthResponse.Type;

export const KairoCloudCapabilitiesResponse = Schema.Struct({
  memory: Schema.Literal(true),
  principal: Schema.Literal("installation"),
});
export type KairoCloudCapabilitiesResponse = typeof KairoCloudCapabilitiesResponse.Type;

export const KairoCloudInstallationExchangeRequest = Schema.Struct({
  environmentId: EnvironmentId,
});
export type KairoCloudInstallationExchangeRequest =
  typeof KairoCloudInstallationExchangeRequest.Type;

export const KairoCloudInstallationExchangeResponse = Schema.Struct({
  accessToken: TrimmedNonEmptyString,
  expiresAtEpochSeconds: Schema.Int.check(Schema.isGreaterThan(0)),
});
export type KairoCloudInstallationExchangeResponse =
  typeof KairoCloudInstallationExchangeResponse.Type;

export const KairoCloudMemorySaveResponse = Schema.Struct({
  id: TrimmedNonEmptyString,
  status: TrimmedNonEmptyString,
});
export type KairoCloudMemorySaveResponse = typeof KairoCloudMemorySaveResponse.Type;

export const KairoCloudMemoryRecallResponse = Schema.Struct({
  results: Schema.Array(Schema.Unknown),
  timing: Schema.Number,
  total: Schema.Number,
});
export type KairoCloudMemoryRecallResponse = typeof KairoCloudMemoryRecallResponse.Type;

export const KairoCloudMemoryContextResponse = Schema.Struct({
  profile: Schema.Struct({
    static: Schema.Array(Schema.String),
    dynamic: Schema.Array(Schema.String),
  }),
  searchResults: Schema.optionalKey(KairoCloudMemoryRecallResponse),
});
export type KairoCloudMemoryContextResponse = typeof KairoCloudMemoryContextResponse.Type;

export const KairoCloudErrorCode = Schema.Literals([
  "auth_invalid",
  "request_invalid",
  "rate_limited",
  "upstream_rejected",
  "upstream_unavailable",
  "request_timeout",
  "internal",
]);
export type KairoCloudErrorCode = typeof KairoCloudErrorCode.Type;

export const KairoCloudErrorResponse = Schema.Struct({
  requestId: TrimmedNonEmptyString,
  code: KairoCloudErrorCode,
  message: TrimmedNonEmptyString,
  retryAfterSeconds: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type KairoCloudErrorResponse = typeof KairoCloudErrorResponse.Type;

export class KairoCloudPrincipal extends Context.Service<
  KairoCloudPrincipal,
  {
    readonly subjectId: string;
    readonly memoryNamespace: string;
    readonly scopes: ReadonlySet<KairoCloudScope>;
  }
>()("@kairo/contracts/cloudApi/KairoCloudPrincipal") {}
