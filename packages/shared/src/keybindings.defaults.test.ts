import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_KEYBINDINGS,
  DEVELOPER_DEFAULT_KEYBINDINGS,
  NON_TECHNICAL_AI_KEYBINDINGS,
} from "./keybindings.ts";

describe("default keybinding profile", () => {
  it("uses the non-technical AI keybinding surface by default", () => {
    expect(DEFAULT_KEYBINDINGS).toBe(NON_TECHNICAL_AI_KEYBINDINGS);
  });

  it("removes terminal and diff shortcuts from the non-technical defaults", () => {
    expect(
      DEVELOPER_DEFAULT_KEYBINDINGS.some((binding) => binding.command === "terminal.toggle"),
    ).toBe(true);
    expect(DEVELOPER_DEFAULT_KEYBINDINGS.some((binding) => binding.command === "diff.toggle")).toBe(
      true,
    );
    expect(NON_TECHNICAL_AI_KEYBINDINGS).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: expect.stringMatching(/^terminal\./u) }),
        expect.objectContaining({ command: "diff.toggle" }),
      ]),
    );
  });

  it("strips terminal focus conditions from retained shortcuts", () => {
    expect(NON_TECHNICAL_AI_KEYBINDINGS).toContainEqual({
      key: "mod+k",
      command: "commandPalette.toggle",
    });
    expect(NON_TECHNICAL_AI_KEYBINDINGS).not.toContainEqual({
      key: "mod+k",
      command: "commandPalette.toggle",
      when: "!terminalFocus",
    });
  });
});
