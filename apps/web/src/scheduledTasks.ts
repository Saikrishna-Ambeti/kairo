export type StudentTaskCategory = "assignments" | "revision" | "classes" | "wellbeing";

export interface StudentScheduledTask {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly schedule: string;
  readonly category: StudentTaskCategory;
}

export interface StudentTaskTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly prompt: string;
  readonly schedule: string;
  readonly category: StudentTaskCategory;
}

export const STUDENT_TASK_TEMPLATES: readonly StudentTaskTemplate[] = [
  {
    id: "assignment-check",
    title: "Assignment check-in",
    description: "Turn upcoming deadlines into a short, realistic work plan.",
    prompt:
      "Review my current assignments and deadlines. Prioritize the next three actions, estimate the time for each, and flag anything at risk.",
    schedule: "Weekdays at 7:00 PM",
    category: "assignments",
  },
  {
    id: "weekly-revision",
    title: "Weekly revision plan",
    description: "Build a revision plan around classes, weak topics, and available time.",
    prompt:
      "Create my revision plan for the next seven days. Give extra time to weak topics, use active recall, and keep each study block under 50 minutes.",
    schedule: "Sundays at 5:00 PM",
    category: "revision",
  },
  {
    id: "lecture-notes",
    title: "Lecture notes cleanup",
    description: "Turn rough notes into a summary, questions, and flashcards.",
    prompt:
      "Review today's lecture notes. Produce a concise summary, list unclear points as questions, and draft ten active-recall flashcards.",
    schedule: "Weekdays at 6:00 PM",
    category: "classes",
  },
  {
    id: "study-reset",
    title: "Study reset",
    description: "Close the week, clear loose ends, and protect time off.",
    prompt:
      "Help me close this study week. List unfinished work, decide what can wait, plan Monday's first task, and reserve one screen-free break.",
    schedule: "Fridays at 8:00 PM",
    category: "wellbeing",
  },
] as const;

export function taskFromTemplate(
  template: StudentTaskTemplate,
  now = new Date(),
): StudentScheduledTask {
  return {
    id: `${template.id}-${now.getTime()}`,
    title: template.title,
    prompt: template.prompt,
    schedule: template.schedule,
    category: template.category,
  };
}

export function removeScheduledTask(
  tasks: readonly StudentScheduledTask[],
  taskId: string,
): readonly StudentScheduledTask[] {
  return tasks.filter((task) => task.id !== taskId);
}
