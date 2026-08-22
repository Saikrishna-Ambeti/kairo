import type {
  ProviderInstanceConfig,
  ProviderInstanceConfigMap,
  ProviderInstanceEnvironmentVariable,
  ProviderInstanceId,
  ServerSettings,
} from "@kairo/contracts";
import { HostProcessEnvironment, HostProcessPlatform } from "@kairo/shared/hostProcess";
import * as Effect from "effect/Effect";

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

function prependPath(
  installDir: string,
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): string {
  const delimiter = platform === "win32" ? ";" : ":";
  return [installDir, environment.PATH].filter(Boolean).join(delimiter);
}

export function buildComposioProviderEnvironment(input: {
  readonly installDir?: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly environment: NodeJS.ProcessEnv;
}): ReadonlyArray<ProviderInstanceEnvironmentVariable> {
  if (!input.installDir) return [];
  return [
    {
      name: "COMPOSIO_INSTALL_DIR",
      value: input.installDir,
      sensitive: false,
    },
    {
      name: "PATH",
      value: prependPath(input.installDir, input.platform, input.environment),
      sensitive: false,
    },
  ];
}

export const applyComposioProviderBindings = Effect.fn(function* (
  settings: ServerSettings,
  configMap: ProviderInstanceConfigMap,
) {
  const composio = settings.integrations.composio;
  if (!composio.enabled || composio.providerInstanceIds.length === 0) {
    return configMap;
  }

  const platform = yield* HostProcessPlatform;
  const environment = yield* HostProcessEnvironment;
  const installDir = environment.COMPOSIO_INSTALL_DIR || `${environment.HOME ?? ""}/.composio`;
  const generated = buildComposioProviderEnvironment({ installDir, platform, environment });
  if (generated.length === 0) return configMap;

  const selectedIds = new Set(composio.providerInstanceIds);
  const merged: Record<string, ProviderInstanceConfig> = { ...configMap };
  for (const [rawInstanceId, instance] of Object.entries(configMap)) {
    if (!selectedIds.has(rawInstanceId as ProviderInstanceId)) continue;
    merged[rawInstanceId] = {
      ...instance,
      environment: mergeGeneratedEnvironment(instance.environment, generated),
    };
  }
  return merged as ProviderInstanceConfigMap;
});
