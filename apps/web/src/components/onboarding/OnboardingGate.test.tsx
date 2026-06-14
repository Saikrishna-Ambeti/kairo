import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import { canNavigateBackToOnboardingStep, isUsableOnboardingAgent } from "./OnboardingGate";

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

describe("onboarding stage navigation", () => {
  it("allows selecting earlier stages", () => {
    expect(canNavigateBackToOnboardingStep("memory", "agents")).toBe(true);
    expect(canNavigateBackToOnboardingStep("finish", "composio")).toBe(true);
  });

  it("does not allow selecting the active or later stages from the rail", () => {
    expect(canNavigateBackToOnboardingStep("memory", "memory")).toBe(false);
    expect(canNavigateBackToOnboardingStep("memory", "composio")).toBe(false);
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
});
