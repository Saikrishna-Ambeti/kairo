import { describe, expect, it } from "@effect/vitest";
import type { ServerProvider } from "@kairo/contracts";

import {
  resolveProviderInteractionModes,
  resolveVisibleInteractionModes,
} from "./interactionModes.ts";

const provider = (patch: Partial<ServerProvider>): ServerProvider =>
  ({
    instanceId: "codex",
    driver: "codex",
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-08-23T00:00:00.000Z",
    models: [],
    skills: [],
    slashCommands: [],
    ...patch,
  }) as ServerProvider;

describe("interaction modes", () => {
  it("uses advertised modes and hides study outside student profiles", () => {
    const snapshot = provider({ supportedInteractionModes: ["default", "plan", "study"] });

    expect(resolveVisibleInteractionModes({ provider: snapshot, studentProfile: false })).toEqual([
      "default",
      "plan",
    ]);
    expect(resolveVisibleInteractionModes({ provider: snapshot, studentProfile: true })).toEqual([
      "default",
      "plan",
      "study",
    ]);
  });

  it("falls back to the legacy plan capability for older servers", () => {
    expect(resolveProviderInteractionModes(provider({ showInteractionModeToggle: true }))).toEqual([
      "default",
      "plan",
    ]);
    expect(resolveProviderInteractionModes(provider({ showInteractionModeToggle: false }))).toEqual(
      ["default"],
    );
  });
});
