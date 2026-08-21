import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import { canNavigateBackToOnboardingStep } from "./OnboardingGate";
import {
  getOnboardingAgentAction,
  getOnboardingAgentDescription,
  isUsableOnboardingAgent,
  resolveOnboardingAgentInstallOutcome,
} from "./OnboardingGate.logic";

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

  it("shows login for installed providers that require authentication", () => {
    const unauthenticatedProvider = provider({
      status: "error",
      auth: { status: "unauthenticated" },
      message: "Codex CLI is not authenticated. Run `codex login` and try again.",
    });
    expect(getOnboardingAgentAction(unauthenticatedProvider)).toBe("login");
    expect(getOnboardingAgentDescription(unauthenticatedProvider)).toBe(
      "Codex CLI is not authenticated. Run `codex login` and try again. Sign in, then refresh detection.",
    );
  });

  it("keeps missing providers on install", () => {
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

  it("offers login after an installed provider probe fails with unknown auth", () => {
    const failedProbe = provider({
      status: "error",
      auth: { status: "unknown" },
      message: "Codex App Server process exited with code 1.",
    });
    expect(getOnboardingAgentAction(failedProbe)).toBe("login");
    expect(getOnboardingAgentDescription(failedProbe)).toContain(
      "Sign in, then refresh detection.",
    );
  });

  it("offers refresh when an authenticated provider still fails its probe", () => {
    expect(
      getOnboardingAgentAction(
        provider({
          status: "error",
          auth: { status: "authenticated" },
          message: "Provider startup check failed.",
        }),
      ),
    ).toBe("refresh");
  });
});

describe("onboarding provider install outcome", () => {
  it("treats encoded maintenance failures as install failures", () => {
    const outcome = resolveOnboardingAgentInstallOutcome(
      provider({
        installed: false,
        status: "error",
        auth: { status: "unknown" },
        updateState: {
          status: "failed",
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:01.000Z",
          message: "Update command exited with code 1.",
          output: "npm permission denied",
        },
      }),
    );

    expect(outcome).toEqual({
      kind: "failed",
      description:
        "Update command exited with code 1.\n\nnpm permission denied\n\nFix the installer error, then retry.",
    });
  });

  it("requires login when install finishes but provider remains unauthenticated", () => {
    expect(
      resolveOnboardingAgentInstallOutcome(
        provider({
          status: "error",
          auth: { status: "unauthenticated" },
          message: "Codex CLI is not authenticated.",
          updateState: {
            status: "succeeded",
            startedAt: "2026-01-01T00:00:00.000Z",
            finishedAt: "2026-01-01T00:00:01.000Z",
            message: "Provider updated.",
            output: null,
          },
        }),
      ),
    ).toEqual({
      kind: "needs_login",
      description: "Codex CLI is not authenticated. Sign in, then refresh detection.",
    });
  });
});
