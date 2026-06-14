import {
  type ProviderDriverKind,
  type ProviderInstanceConfig,
  type ProviderInstanceConfigMap,
  type ProviderInstanceEnvironmentVariable,
  type ProviderInstanceId,
  type ServerSettings,
} from "@kairo/contracts";
import * as Effect from "effect/Effect";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { getSupermemoryApiKey } from "./SupermemorySecrets.ts";

const CODEX_DRIVER = "codex" as ProviderDriverKind;
const CLAUDE_DRIVER = "claudeAgent" as ProviderDriverKind;
const OPENCODE_DRIVER = "opencode" as ProviderDriverKind;

const MEMORY_BINDINGS_BY_DRIVER: Readonly<Record<string, { readonly apiKeyEnv: string }>> = {
  codex: { apiKeyEnv: "SUPERMEMORY_CODEX_API_KEY" },
  claudeAgent: { apiKeyEnv: "SUPERMEMORY_CC_API_KEY" },
  opencode: { apiKeyEnv: "SUPERMEMORY_API_KEY" },
};

export function isSupermemoryDriverSupported(driver: ProviderDriverKind): boolean {
  return driver === CODEX_DRIVER || driver === CLAUDE_DRIVER || driver === OPENCODE_DRIVER;
}

export function buildSupermemoryProviderEnvironment(input: {
  readonly driver: ProviderDriverKind;
  readonly apiKey: string;
}): ReadonlyArray<ProviderInstanceEnvironmentVariable> {
  const binding = MEMORY_BINDINGS_BY_DRIVER[input.driver];
  if (!binding) return [];

  return [
    {
      name: binding.apiKeyEnv,
      value: input.apiKey,
      sensitive: true,
    },
  ];
}

function mergeGeneratedEnvironment(
  existing: ProviderInstanceConfig["environment"],
  generated: ReadonlyArray<ProviderInstanceEnvironmentVariable>,
): ProviderInstanceEnvironmentVariable[] {
  const generatedNames = new Set(generated.map((variable) => variable.name));
  return [
    ...(existing ?? []).filter((variable) => !generatedNames.has(variable.name)),
    ...generated,
  ];
}

export const applySupermemoryProviderBindings = (
  settings: ServerSettings,
  configMap: ProviderInstanceConfigMap,
): Effect.Effect<ProviderInstanceConfigMap, never, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const memory = settings.memory.supermemory;
    if (!memory.enabled || memory.providerInstanceIds.length === 0) {
      return configMap;
    }

    const apiKey = yield* getSupermemoryApiKey().pipe(Effect.orElseSucceed(() => null));
    if (!apiKey) {
      return configMap;
    }

    const selectedIds = new Set<ProviderInstanceId>(memory.providerInstanceIds);
    const merged: Record<string, ProviderInstanceConfig> = { ...configMap };
    for (const [rawInstanceId, instance] of Object.entries(configMap)) {
      const instanceId = rawInstanceId as ProviderInstanceId;
      if (!selectedIds.has(instanceId) || !isSupermemoryDriverSupported(instance.driver)) {
        continue;
      }

      const generated = buildSupermemoryProviderEnvironment({
        driver: instance.driver,
        apiKey,
      });
      if (generated.length === 0) continue;

      merged[rawInstanceId] = {
        ...instance,
        environment: mergeGeneratedEnvironment(instance.environment, generated),
      };
    }

    return merged as ProviderInstanceConfigMap;
  });
