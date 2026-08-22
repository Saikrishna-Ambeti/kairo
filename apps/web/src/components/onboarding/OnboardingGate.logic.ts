import {
  ProviderDriverKind as ProviderDriverKindSchema,
  isProviderAvailable,
  type ProviderDriverKind,
  type ServerProvider,
} from "@kairo/contracts";

export const CODING_AGENT_DRIVERS = new Set<ProviderDriverKind>([
  ProviderDriverKindSchema.make("codex"),
  ProviderDriverKindSchema.make("claudeAgent"),
  ProviderDriverKindSchema.make("opencode"),
]);

export type OnboardingStepKey = "agents" | "memory" | "composio" | "finish";

const ONBOARDING_STEP_ORDER: ReadonlyArray<OnboardingStepKey> = [
  "agents",
  "memory",
  "composio",
  "finish",
];

export function canNavigateBackToOnboardingStep(
  activeStep: OnboardingStepKey,
  targetStep: OnboardingStepKey,
): boolean {
  return ONBOARDING_STEP_ORDER.indexOf(targetStep) < ONBOARDING_STEP_ORDER.indexOf(activeStep);
}

export function isUsableOnboardingAgent(provider: ServerProvider): boolean {
  return (
    CODING_AGENT_DRIVERS.has(provider.driver) &&
    provider.enabled &&
    provider.installed &&
    isProviderAvailable(provider) &&
    provider.status === "ready"
  );
}

export function getOnboardingAgentAction(
  provider: ServerProvider | undefined,
): "detected" | "install" | "login" | "retry" {
  if (provider && isUsableOnboardingAgent(provider)) return "detected";
  if (provider?.enabled && provider.installed && provider.auth.status === "unauthenticated") {
    return "login";
  }
  if (provider?.enabled && provider.installed) return "retry";
  return "install";
}

export function getOnboardingAgentDescription(provider: ServerProvider | undefined): string {
  const action = getOnboardingAgentAction(provider);
  if (action === "login") {
    return "Sign in to this provider to finish detection.";
  }
  if (action === "retry") {
    return provider?.message ?? "The CLI was found, but its health check failed. Retry detection.";
  }
  return (
    provider?.versionAdvisory?.updateCommand ??
    provider?.message ??
    "Install the CLI and refresh detection."
  );
}
