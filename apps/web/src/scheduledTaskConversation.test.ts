import { describe, expect, it } from "vite-plus/test";

import { normalizeRoutineTitle, parseScheduledTaskConversation } from "./scheduledTaskConversation";

describe("scheduled-task conversation", () => {
  it("recognizes explicit routine commands", () => {
    expect(parseScheduledTaskConversation("pause my revision routine.")).toEqual({
      action: "pause",
      title: "revision",
    });
    expect(parseScheduledTaskConversation("run weekly review scheduled task")).toEqual({
      action: "run-now",
      title: "weekly review",
    });
  });

  it("does not intercept ordinary agent prompts", () => {
    expect(parseScheduledTaskConversation("run the tests")).toBeNull();
    expect(normalizeRoutineTitle("  Weekly—Review! ")).toBe("weekly review");
  });
});
