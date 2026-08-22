import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

export const ComposioCloudAuthStatus = Schema.Literals(["not_configured", "configured", "error"]);
export type ComposioCloudAuthStatus = typeof ComposioCloudAuthStatus.Type;

export const ComposioAgentSupportState = Schema.Literals([
  "ready",
  "needs_key",
  "not_selected",
  "unsupported",
]);
export type ComposioAgentSupportState = typeof ComposioAgentSupportState.Type;

export const ComposioCloudAuthState = Schema.Struct({
  status: ComposioCloudAuthStatus,
  hasApiKey: Schema.Boolean,
  lastTestedAt: Schema.optionalKey(Schema.String),
  lastError: Schema.optionalKey(Schema.String),
});
export type ComposioCloudAuthState = typeof ComposioCloudAuthState.Type;

export const ComposioAgentSupportStatus = Schema.Struct({
  providerInstanceId: ProviderInstanceId,
  driver: ProviderDriverKind,
  displayName: Schema.String,
  selected: Schema.Boolean,
  supported: Schema.Boolean,
  status: ComposioAgentSupportState,
  message: Schema.optionalKey(Schema.String),
});
export type ComposioAgentSupportStatus = typeof ComposioAgentSupportStatus.Type;

export const ComposioStatus = Schema.Struct({
  enabled: Schema.Boolean,
  endpoint: Schema.String,
  auth: ComposioCloudAuthState,
  agentSupport: Schema.Array(ComposioAgentSupportStatus),
});
export type ComposioStatus = typeof ComposioStatus.Type;

export const ConfigureComposioInput = Schema.Struct({
  apiKey: Schema.optionalKey(Schema.String),
  providerInstanceIds: Schema.Array(ProviderInstanceId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type ConfigureComposioInput = typeof ConfigureComposioInput.Type;

export const TestComposioConnectionInput = Schema.Struct({
  apiKey: Schema.optionalKey(Schema.String),
});
export type TestComposioConnectionInput = typeof TestComposioConnectionInput.Type;

export class ComposioError extends Schema.TaggedErrorClass<ComposioError>()("ComposioError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}
