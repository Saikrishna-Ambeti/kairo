import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

export const ComposioServiceStatus = Schema.Literals(["available", "unavailable", "error"]);
export type ComposioServiceStatus = typeof ComposioServiceStatus.Type;

export const ComposioAgentSupportState = Schema.Literals([
  "ready",
  "needs_action",
  "not_selected",
  "unsupported",
]);
export type ComposioAgentSupportState = typeof ComposioAgentSupportState.Type;

export const ComposioServiceState = Schema.Struct({
  status: ComposioServiceStatus,
  available: Schema.Boolean,
  lastTestedAt: Schema.optionalKey(Schema.String),
  lastError: Schema.optionalKey(Schema.String),
});
export type ComposioServiceState = typeof ComposioServiceState.Type;

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
  service: ComposioServiceState,
  agentSupport: Schema.Array(ComposioAgentSupportStatus),
});
export type ComposioStatus = typeof ComposioStatus.Type;

export const ConfigureComposioInput = Schema.Struct({
  providerInstanceIds: Schema.Array(ProviderInstanceId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type ConfigureComposioInput = typeof ConfigureComposioInput.Type;

export const TestComposioConnectionInput = Schema.Struct({});
export type TestComposioConnectionInput = typeof TestComposioConnectionInput.Type;

export class ComposioError extends Schema.TaggedErrorClass<ComposioError>()("ComposioError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}
