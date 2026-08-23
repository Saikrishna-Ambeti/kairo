import { describe, expect, it } from "@effect/vitest";

import { applyStudyModeInstructions } from "./StudyModeInstructions.ts";

describe("applyStudyModeInstructions", () => {
  it("leaves ordinary turns unchanged", () => {
    expect(applyStudyModeInstructions("Explain this", "default")).toBe("Explain this");
  });

  it("wraps study turns with tutor instructions", () => {
    const result = applyStudyModeInstructions("Help me understand recursion", "study");

    expect(result).toContain("Act as a patient coding tutor");
    expect(result).toContain("use the recall memory tool");
    expect(result).toContain("Do this even in a different thread");
    expect(result).toContain("first incomplete item");
    expect(result).toContain("use the memory tool");
    expect(result).toContain("Do not restart the curriculum");
    expect(result).toContain("<student_message>\nHelp me understand recursion\n</student_message>");
  });
});
