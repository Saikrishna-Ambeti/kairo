import { describe, expect, it } from "vite-plus/test";

import { STUDENT_TASK_TEMPLATES, removeScheduledTask, taskFromTemplate } from "./scheduledTasks";

describe("student scheduled tasks", () => {
  it("creates an enabled task from a student template", () => {
    const task = taskFromTemplate(STUDENT_TASK_TEMPLATES[0]!, new Date(123));

    expect(task).toMatchObject({
      id: "assignment-check-123",
      title: "Assignment check-in",
      category: "assignments",
    });
  });

  it("removes only the selected task", () => {
    const first = taskFromTemplate(STUDENT_TASK_TEMPLATES[0]!, new Date(1));
    const second = taskFromTemplate(STUDENT_TASK_TEMPLATES[1]!, new Date(2));

    expect(removeScheduledTask([first, second], first.id)).toEqual([second]);
  });
});
