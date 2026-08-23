import type { ProviderInteractionMode, ServerProvider } from "@kairo/contracts";

const DEFAULT_ONLY = ["default"] as const satisfies ReadonlyArray<ProviderInteractionMode>;
const DEFAULT_AND_PLAN = [
  "default",
  "plan",
] as const satisfies ReadonlyArray<ProviderInteractionMode>;

export function resolveProviderInteractionModes(
  provider: ServerProvider | null | undefined,
): ReadonlyArray<ProviderInteractionMode> {
  if (provider?.supportedInteractionModes && provider.supportedInteractionModes.length > 0) {
    return provider.supportedInteractionModes;
  }

  return (provider?.showInteractionModeToggle ?? true) ? DEFAULT_AND_PLAN : DEFAULT_ONLY;
}

export function resolveVisibleInteractionModes(input: {
  readonly provider: ServerProvider | null | undefined;
  readonly studentProfile: boolean;
}): ReadonlyArray<ProviderInteractionMode> {
  return resolveProviderInteractionModes(input.provider).filter(
    (mode) => mode !== "study" || input.studentProfile,
  );
}
