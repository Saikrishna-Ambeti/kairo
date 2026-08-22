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
import { getComposioApiKey } from "./ComposioSecrets.ts";

export const COMPOSIO_MCP_URL = "https://connect.composio.dev/mcp";
export const COMPOSIO_API_KEY_ENV = "KAIRO_COMPOSIO_API_KEY";

const SUPPORTED_DRIVERS = new Set<string>(["codex", "claudeAgent", "cursor", "grok"]);

export function isComposioDriverSupported(driver: ProviderDriverKind): boolean {
  return SUPPORTED_DRIVERS.has(driver);
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

export function buildComposioProviderEnvironment(input: {
  readonly apiKey: string;
}): ReadonlyArray<ProviderInstanceEnvironmentVariable> {
  return [
    {
      name: COMPOSIO_API_KEY_ENV,
      value: input.apiKey,
      sensitive: true,
    },
  ];
}

export const applyComposioProviderBindings = (
  settings: ServerSettings,
  configMap: ProviderInstanceConfigMap,
): Effect.Effect<ProviderInstanceConfigMap, never, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const composio = settings.integrations.composio;
    if (!composio.enabled || composio.providerInstanceIds.length === 0) {
      return configMap;
    }

    const apiKey = yield* getComposioApiKey().pipe(Effect.orElseSucceed(() => null));
    if (!apiKey) return configMap;

    const generated = buildComposioProviderEnvironment({ apiKey });
    const selectedIds = new Set<ProviderInstanceId>(composio.providerInstanceIds);
    const merged: Record<string, ProviderInstanceConfig> = { ...configMap };
    for (const [rawInstanceId, instance] of Object.entries(configMap)) {
      const instanceId = rawInstanceId as ProviderInstanceId;
      if (!selectedIds.has(instanceId) || !isComposioDriverSupported(instance.driver)) continue;
      merged[rawInstanceId] = {
        ...instance,
        environment: mergeGeneratedEnvironment(instance.environment, generated),
      };
    }
    return merged as ProviderInstanceConfigMap;
  });
