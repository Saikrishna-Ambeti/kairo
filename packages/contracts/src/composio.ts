import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

export const ComposioCliInstallStatus = Schema.Literals([
  "missing",
  "installing",
  "needs_login",
  "authenticated",
  "error",
  "unsupported",
]);
export type ComposioCliInstallStatus = typeof ComposioCliInstallStatus.Type;

export const ComposioPlatform = Schema.Literals(["darwin", "linux", "win32", "other"]);
export type ComposioPlatform = typeof ComposioPlatform.Type;

export const ComposioAuthStatus = Schema.Literals(["authenticated", "unauthenticated", "unknown"]);
export type ComposioAuthStatus = typeof ComposioAuthStatus.Type;

export const ComposioToolkitConnectionStatus = Schema.Literals([
  "connected",
  "not_connected",
  "unknown",
  "error",
]);
export type ComposioToolkitConnectionStatus = typeof ComposioToolkitConnectionStatus.Type;

export const ComposioToolkitCategory = Schema.Literals([
  "productivity",
  "communication",
  "google-workspace",
  "other",
]);
export type ComposioToolkitCategory = typeof ComposioToolkitCategory.Type;

export const ComposioAgentSkillStatus = Schema.Literals([
  "ready",
  "needs_install",
  "installing",
  "unsupported",
  "error",
]);
export type ComposioAgentSkillStatus = typeof ComposioAgentSkillStatus.Type;

export const ComposioOperationKind = Schema.Literals([
  "install_and_login",
  "login",
  "link_toolkit",
  "install_agent_support",
]);
export type ComposioOperationKind = typeof ComposioOperationKind.Type;

export const ComposioOperationStatus = Schema.Literals(["running", "succeeded", "failed"]);
export type ComposioOperationStatus = typeof ComposioOperationStatus.Type;

export const ComposioPrimaryAction = Schema.Literals(["install_and_login", "login", "none"]);
export type ComposioPrimaryAction = typeof ComposioPrimaryAction.Type;

export const ComposioCliState = Schema.Struct({
  status: ComposioCliInstallStatus,
  platform: ComposioPlatform,
  installCommandLabel: Schema.String,
  executablePath: Schema.optionalKey(Schema.String),
  version: Schema.optionalKey(Schema.String),
  lastCheckedAt: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
});
export type ComposioCliState = typeof ComposioCliState.Type;

export const ComposioAuthState = Schema.Struct({
  status: ComposioAuthStatus,
  accountLabel: Schema.optionalKey(Schema.String),
  orgId: Schema.optionalKey(Schema.String),
  projectId: Schema.optionalKey(Schema.String),
  userId: Schema.optionalKey(Schema.String),
});
export type ComposioAuthState = typeof ComposioAuthState.Type;

export const ComposioToolkitStatus = Schema.Struct({
  toolkit: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  category: ComposioToolkitCategory,
  connectionStatus: ComposioToolkitConnectionStatus,
  accountLabel: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
});
export type ComposioToolkitStatus = typeof ComposioToolkitStatus.Type;

export const ComposioToolkitCatalogItem = Schema.Struct({
  toolkit: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  category: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  logoUrl: Schema.optionalKey(Schema.String),
  appUrl: Schema.optionalKey(Schema.String),
  toolsCount: Schema.optionalKey(Schema.Number),
  triggersCount: Schema.optionalKey(Schema.Number),
});
export type ComposioToolkitCatalogItem = typeof ComposioToolkitCatalogItem.Type;

export const ComposioToolkitCatalogSource = Schema.Literals(["cli", "fallback"]);
export type ComposioToolkitCatalogSource = typeof ComposioToolkitCatalogSource.Type;

export const ComposioToolkitCatalog = Schema.Struct({
  items: Schema.Array(ComposioToolkitCatalogItem),
  source: ComposioToolkitCatalogSource,
  message: Schema.optionalKey(Schema.String),
});
export type ComposioToolkitCatalog = typeof ComposioToolkitCatalog.Type;

export const ComposioAgentSupportStatus = Schema.Struct({
  providerInstanceId: ProviderInstanceId,
  driver: ProviderDriverKind,
  displayName: Schema.String,
  selected: Schema.Boolean,
  cliAvailable: Schema.Boolean,
  skillStatus: ComposioAgentSkillStatus,
  message: Schema.optionalKey(Schema.String),
});
export type ComposioAgentSupportStatus = typeof ComposioAgentSupportStatus.Type;

export const ComposioOperation = Schema.Struct({
  id: TrimmedNonEmptyString,
  kind: ComposioOperationKind,
  status: ComposioOperationStatus,
  startedAt: Schema.String,
  updatedAt: Schema.String,
  message: Schema.optionalKey(Schema.String),
});
export type ComposioOperation = typeof ComposioOperation.Type;

export const ComposioStatus = Schema.Struct({
  enabled: Schema.Boolean,
  primaryAction: ComposioPrimaryAction,
  cli: ComposioCliState,
  auth: ComposioAuthState,
  toolkits: Schema.Array(ComposioToolkitStatus),
  agentSupport: Schema.Array(ComposioAgentSupportStatus),
  operation: Schema.optionalKey(ComposioOperation),
});
export type ComposioStatus = typeof ComposioStatus.Type;

export const InstallComposioInput = Schema.Struct({
  providerInstanceIds: Schema.Array(ProviderInstanceId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type InstallComposioInput = typeof InstallComposioInput.Type;

export const LinkComposioToolkitInput = Schema.Struct({
  toolkit: TrimmedNonEmptyString,
});
export type LinkComposioToolkitInput = typeof LinkComposioToolkitInput.Type;

export const ListComposioToolkitsInput = Schema.Struct({
  search: Schema.optionalKey(Schema.String),
  limit: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(100))),
});
export type ListComposioToolkitsInput = typeof ListComposioToolkitsInput.Type;

export const InstallComposioAgentSupportInput = Schema.Struct({
  providerInstanceIds: Schema.Array(ProviderInstanceId),
});
export type InstallComposioAgentSupportInput = typeof InstallComposioAgentSupportInput.Type;

export const ComposioOperationProgressEvent = Schema.Struct({
  type: Schema.Literal("progress"),
  operation: ComposioOperation,
  stage: Schema.String,
  message: Schema.String,
  stdout: Schema.optionalKey(Schema.String),
  stderr: Schema.optionalKey(Schema.String),
  authUrl: Schema.optionalKey(Schema.String),
});
export type ComposioOperationProgressEvent = typeof ComposioOperationProgressEvent.Type;

export class ComposioError extends Schema.TaggedErrorClass<ComposioError>()("ComposioError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}
