export interface ScheduledTaskConversationIntent {
  readonly action: "pause" | "resume" | "run-now" | "delete";
  readonly title: string;
}

export function parseScheduledTaskConversation(
  text: string,
): ScheduledTaskConversationIntent | null {
  const match =
    /^(pause|resume|run|delete)\s+(?:my\s+)?(.+?)\s+(?:routine|scheduled task)[.!?]*$/i.exec(
      text.trim(),
    );
  if (!match) return null;
  const verb = match[1]?.toLowerCase();
  const title = match[2]?.trim() ?? "";
  if (!title) return null;
  return {
    action: verb === "run" ? "run-now" : (verb as "pause" | "resume" | "delete"),
    title,
  };
}

export function normalizeRoutineTitle(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
