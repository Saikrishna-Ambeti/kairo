import { describe, expect, it } from "vite-plus/test";

import { canNavigateBackToOnboardingStep } from "./OnboardingGate";

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
