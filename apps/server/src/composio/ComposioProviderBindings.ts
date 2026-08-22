import {
  DEFAULT_KAIRO_CLOUD_API_URL,
  type ProviderDriverKind,
  type ProviderInstanceConfig,
  type ProviderInstanceConfigMap,
  type ProviderInstanceEnvironmentVariable,
  type ProviderInstanceId,
  type ServerSettings,
} from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { getComposioAccessToken } from "./ComposioSecrets.ts";

export const COMPOSIO_MCP_URL_ENV = "KAIRO_COMPOSIO_MCP_URL";
export const COMPOSIO_AUTHORIZATION_ENV = "KAIRO_COMPOSIO_AUTHORIZATION";

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
  readonly accessToken: Redacted.Redacted<string>;
  readonly cloudApiUrl: string;
}): ReadonlyArray<ProviderInstanceEnvironmentVariable> {
  const mcpUrl = new URL("/v1/composio/mcp", input.cloudApiUrl).toString();
  return [
    {
      name: COMPOSIO_MCP_URL_ENV,
      value: mcpUrl,
      sensitive: false,
    },
    {
      name: COMPOSIO_AUTHORIZATION_ENV,
      value: `Bearer ${Redacted.value(input.accessToken)}`,
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

    const accessToken = yield* getComposioAccessToken().pipe(Effect.orElseSucceed(() => null));
    if (!accessToken) return configMap;

    const generated = buildComposioProviderEnvironment({
      accessToken,
      cloudApiUrl: process.env.KAIRO_CLOUD_API_URL ?? DEFAULT_KAIRO_CLOUD_API_URL,
    });
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
