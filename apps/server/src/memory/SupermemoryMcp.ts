import {
  ProviderDriverKind,
  type ProviderInstanceId,
  type SupermemoryProviderStatus,
} from "@kairo/contracts";

const SUPPORTED_DRIVERS = new Set<ProviderDriverKind>([
  ProviderDriverKind.make("codex"),
  ProviderDriverKind.make("claudeAgent"),
  ProviderDriverKind.make("cursor"),
  ProviderDriverKind.make("grok"),
  ProviderDriverKind.make("opencode"),
]);

export function isSupermemoryDriverSupported(driver: ProviderDriverKind): boolean {
  return SUPPORTED_DRIVERS.has(driver);
}

export function computeProviderMemoryStatus(input: {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly displayName: string;
  readonly selected: boolean;
  readonly serviceConfigured: boolean;
}): SupermemoryProviderStatus {
  if (!isSupermemoryDriverSupported(input.driver)) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: input.selected,
      supported: false,
      status: "unsupported",
      message: "This provider does not support Kairo's hosted Supermemory connection.",
    };
  }

  if (!input.selected) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: false,
      supported: true,
      status: "not_selected",
    };
  }

  if (!input.serviceConfigured) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: true,
      supported: true,
      status: "needs_action",
      message: "Hosted Supermemory is unavailable on this server.",
    };
  }

  return {
    instanceId: input.instanceId,
    driver: input.driver,
    displayName: input.displayName,
    selected: true,
    supported: true,
    status: "ready",
    message: "Hosted Supermemory is available in new provider sessions.",
  };
}
