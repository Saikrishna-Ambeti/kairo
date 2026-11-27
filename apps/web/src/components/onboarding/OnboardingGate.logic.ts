import { msg } from "gt-react";
import { m, type MessageResolver } from "../../i18n/messages";
import {
  ProviderDriverKind,
  isProviderAvailable,
  type ProviderInstanceId,
  type ServerProvider,
} from "@kairo/contracts";

export const ONBOARDING_CODING_AGENT_DRIVERS = new Set([
  ProviderDriverKind.make("codex"),
  ProviderDriverKind.make("claudeAgent"),
  ProviderDriverKind.make("opencode"),
]);

export type OnboardingAgentAction = "detected" | "install" | "login" | "refresh";

export type OnboardingAgentReadiness =
  | { readonly kind: "ready" }
  | { readonly kind: "needs_login"; readonly description: string }
  | { readonly kind: "needs_attention"; readonly description: string }
  | { readonly kind: "missing"; readonly description: string };

export type OnboardingAgentInstallOutcome =
  | OnboardingAgentReadiness
  | { readonly kind: "failed"; readonly description: string };

export function isUsableOnboardingAgent(provider: ServerProvider): boolean {
  return (
    ONBOARDING_CODING_AGENT_DRIVERS.has(provider.driver) &&
    provider.enabled &&
    provider.installed &&
    isProviderAvailable(provider) &&
    provider.status === "ready"
  );
}

export function getOnboardingAgentAction(
  provider: ServerProvider | undefined,
): OnboardingAgentAction {
  if (provider && isUsableOnboardingAgent(provider)) return "detected";
  if (!provider?.installed) return "install";
  if (provider.auth.status === "unauthenticated" || provider.auth.status === "unknown") {
    return "login";
  }
  return "refresh";
}

function appendRecovery(message: string | undefined, recovery: string): string {
  if (!message) return recovery;
  return `${message} ${recovery}`;
}

export function getOnboardingAgentDescription(
  provider: ServerProvider | undefined,
  resolve: MessageResolver = m,
): string {
  const action = getOnboardingAgentAction(provider);
  if (action === "login") {
    return appendRecovery(provider?.message, resolve(msg("Sign in, then refresh detection.")));
  }
  if (action === "refresh") {
    return appendRecovery(
      provider?.message,
      resolve(msg("Fix the CLI issue, then refresh detection.")),
    );
  }
  if (action === "install") {
    const updateState = provider?.updateState;
    if (updateState?.status === "failed") {
      return appendRecovery(
        updateState.message ?? undefined,
        resolve(msg("Fix the installer error and retry.")),
      );
    }
    if (updateState?.status === "unchanged") {
      return appendRecovery(
        updateState.message ?? undefined,
        resolve(msg("Check the install command and retry.")),
      );
    }
  }
  return (
    provider?.versionAdvisory?.updateCommand ??
    provider?.message ??
    resolve(msg("Checking installer availability."))
  );
}

export function getOnboardingAgentProgressLabel(
  provider: ServerProvider | undefined,
  installRequested: boolean,
  providerLabel: string,
  resolve: MessageResolver = m,
): string | null {
  if (provider?.updateState?.status === "queued") return resolve(msg("Waiting for installer"));
  if (provider?.updateState?.status === "running")
    return resolve(msg("Installing {provider}"), { provider: providerLabel });
  return installRequested ? resolve(msg("Starting installer")) : null;
}

export function resolveOnboardingAgentReadiness(
  provider: ServerProvider | undefined,
  resolve: MessageResolver = m,
): OnboardingAgentReadiness {
  if (!provider || !provider.installed) {
    return {
      kind: "missing",
      description: resolve(
        msg("Kairo still cannot find the CLI. Check PATH, then retry detection."),
      ),
    };
  }
  if (isUsableOnboardingAgent(provider)) return { kind: "ready" };
  if (provider.auth.status === "unauthenticated" || provider.auth.status === "unknown") {
    return {
      kind: "needs_login",
      description: appendRecovery(
        provider.message,
        resolve(msg("Sign in, then refresh detection.")),
      ),
    };
  }
  return {
    kind: "needs_attention",
    description: appendRecovery(
      provider.message,
      resolve(msg("Fix the CLI issue, then refresh detection.")),
    ),
  };
}

export function resolveOnboardingAgentInstallOutcome(
  provider: ServerProvider | undefined,
  resolve: MessageResolver = m,
): OnboardingAgentInstallOutcome {
  const updateState = provider?.updateState;
  if (updateState?.status === "failed") {
    return {
      kind: "failed",
      description: [
        updateState.message ?? resolve(msg("Install command failed.")),
        updateState.output,
        resolve(msg("Fix the installer error, then retry.")),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    };
  }
  if (updateState?.status === "unchanged") {
    return {
      kind: "failed",
      description: appendRecovery(
        updateState.message ?? undefined,
        resolve(msg("Check the install command, then retry.")),
      ),
    };
  }
  return resolveOnboardingAgentReadiness(provider, resolve);
}

export function findOnboardingProvider(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId,
): ServerProvider | undefined {
  return providers.find((provider) => provider.instanceId === instanceId);
}
