import type {
  ProviderInstanceConfig,
  ProviderInstanceConfigMap,
  ProviderInstanceEnvironmentVariable,
  ProviderInstanceId,
  ServerSettings,
} from "@t3tools/contracts";

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

function prependPath(installDir: string): string {
  const delimiter = process.platform === "win32" ? ";" : ":";
  return [installDir, process.env.PATH].filter(Boolean).join(delimiter);
}

export function buildComposioProviderEnvironment(input: {
  readonly installDir?: string | undefined;
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
      value: prependPath(input.installDir),
      sensitive: false,
    },
  ];
}

export function applyComposioProviderBindings(
  settings: ServerSettings,
  configMap: ProviderInstanceConfigMap,
): ProviderInstanceConfigMap {
  const composio = settings.integrations.composio;
  if (!composio.enabled || composio.providerInstanceIds.length === 0) {
    return configMap;
  }

  const installDir = process.env.COMPOSIO_INSTALL_DIR || `${process.env.HOME ?? ""}/.composio`;
  const generated = buildComposioProviderEnvironment({ installDir });
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
}
