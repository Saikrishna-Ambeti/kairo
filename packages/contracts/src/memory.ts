import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";

export const SupermemoryMode = Schema.Literals(["hosted", "local"]).transform(["hosted", "hosted"]);
export type SupermemoryMode = typeof SupermemoryMode.Type;

export const SupermemoryScope = Schema.Literal("user");
export type SupermemoryScope = typeof SupermemoryScope.Type;

export const SupermemorySettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  mode: SupermemoryMode.pipe(Schema.withDecodingDefault(Effect.succeed("hosted" as const))),
  scope: SupermemoryScope.pipe(Schema.withDecodingDefault(Effect.succeed("user" as const))),
  providerInstanceIds: Schema.Array(ProviderInstanceId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type SupermemorySettings = typeof SupermemorySettings.Type;

export const DEFAULT_SUPERMEMORY_SETTINGS: SupermemorySettings = Schema.decodeSync(
  SupermemorySettings,
)({});

export const MemorySettings = Schema.Struct({
  supermemory: SupermemorySettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
}).pipe(Schema.withDecodingDefault(Effect.succeed({})));
export type MemorySettings = typeof MemorySettings.Type;

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = Schema.decodeSync(MemorySettings)({});

export const MemorySettingsPatch = Schema.Struct({
  supermemory: Schema.optionalKey(
    Schema.Struct({
      enabled: Schema.optionalKey(Schema.Boolean),
      mode: Schema.optionalKey(SupermemoryMode),
      scope: Schema.optionalKey(SupermemoryScope),
      providerInstanceIds: Schema.optionalKey(Schema.Array(ProviderInstanceId)),
    }),
  ),
});
export type MemorySettingsPatch = typeof MemorySettingsPatch.Type;

export const ConfigureMemoryInput = Schema.Struct({
  providerInstanceIds: Schema.Array(ProviderInstanceId),
});
export type ConfigureMemoryInput = typeof ConfigureMemoryInput.Type;

export const SupermemoryProviderState = Schema.Literals([
  "not_selected",
  "ready",
  "needs_action",
  "error",
  "unsupported",
]);
export type SupermemoryProviderState = typeof SupermemoryProviderState.Type;

export const SupermemoryProviderStatus = Schema.Struct({
  instanceId: ProviderInstanceId,
  driver: ProviderDriverKind,
  displayName: Schema.String,
  selected: Schema.Boolean,
  supported: Schema.Boolean,
  status: SupermemoryProviderState,
  message: Schema.optionalKey(Schema.String),
});
export type SupermemoryProviderStatus = typeof SupermemoryProviderStatus.Type;

export const SupermemoryStatus = Schema.Struct({
  enabled: Schema.Boolean,
  mode: SupermemoryMode,
  scope: SupermemoryScope,
  service: Schema.Struct({
    available: Schema.Boolean,
  }),
  providers: Schema.Array(SupermemoryProviderStatus),
});
export type SupermemoryStatus = typeof SupermemoryStatus.Type;

export class SupermemoryError extends Schema.TaggedErrorClass<SupermemoryError>()(
  "SupermemoryError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
