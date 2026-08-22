import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  advanceOnboardingStep,
  getOnboardingAgentAction,
  getOnboardingAgentDescription,
  isUsableOnboardingAgent,
} from "./OnboardingGate";

function provider(input: Partial<ServerProvider> = {}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...input,
  };
}

describe("onboarding flow", () => {
  it("runs sign-in, profession, and provider setup in order", () => {
    expect(advanceOnboardingStep("sign-in")).toBe("profession");
    expect(advanceOnboardingStep("profession")).toBe("setup");
    expect(advanceOnboardingStep("setup")).toBe("setup");
  });
});

describe("onboarding agent detection", () => {
  it("counts ready installed coding agents as usable", () => {
    expect(isUsableOnboardingAgent(provider())).toBe(true);
  });

  it("does not count failed, missing, or unavailable providers as usable", () => {
    expect(
      isUsableOnboardingAgent(
        provider({
          status: "error",
          auth: { status: "unknown" },
          message: "Codex CLI (`codex`) is not installed or not on PATH.",
        }),
      ),
    ).toBe(false);
    expect(isUsableOnboardingAgent(provider({ installed: false }))).toBe(false);
    expect(isUsableOnboardingAgent(provider({ availability: "unavailable" }))).toBe(false);
  });

  it("shows login for installed providers that require authentication", () => {
    const unauthenticatedProvider = provider({
      status: "error",
      auth: { status: "unauthenticated" },
      message: "Codex CLI is not authenticated. Run `codex login` and try again.",
    });
    expect(getOnboardingAgentAction(unauthenticatedProvider)).toBe("login");
    expect(getOnboardingAgentDescription(unauthenticatedProvider)).toBe(
      "Sign in to this provider to finish detection.",
    );
  });

  it("keeps failed unauthenticated providers on install when they are missing", () => {
    expect(
      getOnboardingAgentAction(
        provider({
          installed: false,
          status: "error",
          auth: { status: "unknown" },
        }),
      ),
    ).toBe("install");
  });
});
