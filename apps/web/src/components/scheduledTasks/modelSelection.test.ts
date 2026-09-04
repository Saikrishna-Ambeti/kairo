import {
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  type OrchestrationProjectShell,
  type ServerProvider,
} from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  isScheduledTaskProviderAvailable,
  modelSelectionForProject,
  modelSelectionForProvider,
  reasoningDescriptorForSelection,
  withReasoningSelection,
} from "./modelSelection";

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
    models: [
      {
        slug: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        isCustom: false,
        isDefault: true,
        capabilities: {
          optionDescriptors: [
            {
              id: "reasoningEffort",
              label: "Reasoning",
              type: "select",
              options: [
                { id: "low", label: "Low" },
                { id: "high", label: "High", isDefault: true },
              ],
              currentValue: "high",
            },
            {
              id: "fastMode",
              label: "Fast mode",
              type: "boolean",
              currentValue: true,
            },
          ],
        },
      },
      {
        slug: "gpt-5.6-luna",
        name: "GPT-5.6 Luna",
        isCustom: false,
        capabilities: {
          optionDescriptors: [
            {
              id: "reasoningEffort",
              label: "Reasoning",
              type: "select",
              options: [
                { id: "medium", label: "Medium", isDefault: true },
                { id: "high", label: "High" },
              ],
              currentValue: "medium",
            },
          ],
        },
      },
    ],
    slashCommands: [],
    skills: [],
    ...input,
  };
}

function project(
  defaultModelSelection: OrchestrationProjectShell["defaultModelSelection"],
): OrchestrationProjectShell {
  return {
    id: ProjectId.make("project-1"),
    title: "Kairo",
    workspaceRoot: "/tmp/kairo",
    defaultModelSelection,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("scheduled task model selection", () => {
  it("starts from the project's provider, model, and reasoning", () => {
    const snapshot = provider();
    const selection = modelSelectionForProject(
      project({
        instanceId: snapshot.instanceId,
        model: "gpt-5.6-sol",
        options: [{ id: "reasoningEffort", value: "low" }],
      }),
      [snapshot],
    );

    expect(selection).toEqual({
      instanceId: "codex",
      model: "gpt-5.6-sol",
      options: [
        { id: "reasoningEffort", value: "low" },
        { id: "fastMode", value: true },
      ],
    });
  });

  it("uses the selected model's reasoning default when the model changes", () => {
    expect(modelSelectionForProvider(provider(), "gpt-5.6-luna")).toEqual({
      instanceId: "codex",
      model: "gpt-5.6-luna",
      options: [{ id: "reasoningEffort", value: "medium" }],
    });
  });

  it("changes reasoning without discarding other provider options", () => {
    const selection = modelSelectionForProvider(provider());
    expect(selection).not.toBeNull();
    if (!selection) return;

    expect(withReasoningSelection(selection, "reasoningEffort", "low")).toEqual({
      ...selection,
      options: [
        { id: "fastMode", value: true },
        { id: "reasoningEffort", value: "low" },
      ],
    });
  });

  it("hides prompt-only reasoning choices from scheduled runs", () => {
    const snapshot = provider({
      models: [
        {
          slug: "claude-opus",
          name: "Claude Opus",
          isCustom: false,
          isDefault: true,
          capabilities: {
            optionDescriptors: [
              {
                id: "effort",
                label: "Reasoning",
                type: "select",
                options: [
                  { id: "high", label: "High", isDefault: true },
                  { id: "ultrathink", label: "Ultrathink" },
                ],
                currentValue: "high",
                promptInjectedValues: ["ultrathink"],
              },
            ],
          },
        },
      ],
    });
    const selection = modelSelectionForProvider(snapshot);

    expect(reasoningDescriptorForSelection(snapshot, selection)?.options).toEqual([
      { id: "high", label: "High", isDefault: true },
    ]);
  });

  it("excludes unavailable providers", () => {
    expect(isScheduledTaskProviderAvailable(provider({ availability: "unavailable" }))).toBe(false);
  });
});
