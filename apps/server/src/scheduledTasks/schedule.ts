import type { ScheduledTaskTrigger } from "@kairo/contracts";

const MINUTE_MS = 60_000;
const SEARCH_LIMIT_MINUTES = 366 * 24 * 60 * 2;

export interface ZonedMinute {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly weekday: number;
  readonly key: string;
}

const WEEKDAY_BY_NAME: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function zonedMinute(atMs: number, timeZone: string): ZonedMinute {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(atMs);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hourValue = Number(value("hour"));
  const hour = hourValue === 24 ? 0 : hourValue;
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const minute = Number(value("minute"));
  const weekday = WEEKDAY_BY_NAME[value("weekday")] ?? 0;
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    key: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function parseClock(value: string): { readonly hour: number; readonly minute: number } {
  const [hour = "0", minute = "0"] = value.split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

function expandCronField(
  expression: string,
  minimum: number,
  maximum: number,
  normalize: (value: number) => number = (value) => value,
): ReadonlySet<number> | null {
  const result = new Set<number>();
  for (const segment of expression.split(",")) {
    const [rangeExpression = "", stepExpression] = segment.split("/");
    const step = stepExpression === undefined ? 1 : Number(stepExpression);
    if (!Number.isInteger(step) || step < 1) return null;
    let start: number;
    let end: number;
    if (rangeExpression === "*") {
      start = minimum;
      end = maximum;
    } else if (rangeExpression.includes("-")) {
      const [startExpression = "", endExpression = ""] = rangeExpression.split("-");
      start = Number(startExpression);
      end = Number(endExpression);
    } else {
      start = Number(rangeExpression);
      end = start;
    }
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < minimum ||
      end > maximum ||
      start > end
    ) {
      return null;
    }
    for (let value = start; value <= end; value += step) result.add(normalize(value));
  }
  return result;
}

interface ParsedCron {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly days: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly weekdays: ReadonlySet<number>;
}

export function parseCron(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, day, month, weekday] = fields;
  const parsed = {
    minutes: expandCronField(minute ?? "", 0, 59),
    hours: expandCronField(hour ?? "", 0, 23),
    days: expandCronField(day ?? "", 1, 31),
    months: expandCronField(month ?? "", 1, 12),
    weekdays: expandCronField(weekday ?? "", 0, 7, (value) => (value === 7 ? 0 : value)),
  };
  return Object.values(parsed).every((field) => field !== null) ? (parsed as ParsedCron) : null;
}

function matchesTrigger(trigger: ScheduledTaskTrigger, minute: ZonedMinute): boolean {
  switch (trigger.kind) {
    case "hourly":
      return minute.minute === trigger.minute;
    case "daily": {
      const clock = parseClock(trigger.time);
      return minute.hour === clock.hour && minute.minute === clock.minute;
    }
    case "weekdays": {
      const clock = parseClock(trigger.time);
      return (
        minute.weekday >= 1 &&
        minute.weekday <= 5 &&
        minute.hour === clock.hour &&
        minute.minute === clock.minute
      );
    }
    case "weekly": {
      const clock = parseClock(trigger.time);
      return (
        minute.weekday === trigger.dayOfWeek &&
        minute.hour === clock.hour &&
        minute.minute === clock.minute
      );
    }
    case "cron": {
      const parsed = parseCron(trigger.expression);
      return (
        parsed !== null &&
        parsed.minutes.has(minute.minute) &&
        parsed.hours.has(minute.hour) &&
        parsed.days.has(minute.day) &&
        parsed.months.has(minute.month) &&
        parsed.weekdays.has(minute.weekday)
      );
    }
    default:
      return false;
  }
}

export function nextScheduledOccurrence(input: {
  readonly trigger: ScheduledTaskTrigger;
  readonly timeZone: string;
  readonly afterMs: number;
  readonly dedupeLocalKey?: string;
}): number | null {
  if (!isValidTimeZone(input.timeZone)) return null;
  if (input.trigger.kind === "one-time") {
    const atMs = Date.parse(input.trigger.at);
    return Number.isFinite(atMs) && atMs > input.afterMs ? atMs : null;
  }
  if (
    input.trigger.kind === "manual" ||
    input.trigger.kind === "webhook" ||
    input.trigger.kind === "calendar" ||
    input.trigger.kind === "email" ||
    input.trigger.kind === "github"
  ) {
    return null;
  }
  if (input.trigger.kind === "cron" && parseCron(input.trigger.expression) === null) return null;

  let candidate = Math.floor(input.afterMs / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  for (let index = 0; index < SEARCH_LIMIT_MINUTES; index += 1) {
    const parts = zonedMinute(candidate, input.timeZone);
    if (parts.key !== input.dedupeLocalKey && matchesTrigger(input.trigger, parts)) {
      return candidate;
    }
    candidate += MINUTE_MS;
  }
  return null;
}

export function dueOccurrences(input: {
  readonly trigger: ScheduledTaskTrigger;
  readonly timeZone: string;
  readonly nextRunAtMs: number;
  readonly nowMs: number;
  readonly missedRuns: "skip" | "catch-up-once" | "catch-up-all";
}): ReadonlyArray<number> {
  if (input.nextRunAtMs > input.nowMs) return [];
  if (input.missedRuns === "skip") return [input.nextRunAtMs];

  const due: number[] = [input.nextRunAtMs];
  let cursor = input.nextRunAtMs;
  while (due.length < 100) {
    const next = nextScheduledOccurrence({
      trigger: input.trigger,
      timeZone: input.timeZone,
      afterMs: cursor,
      dedupeLocalKey: zonedMinute(cursor, input.timeZone).key,
    });
    if (next === null || next > input.nowMs) break;
    due.push(next);
    cursor = next;
  }
  return input.missedRuns === "catch-up-once" ? [due.at(-1) ?? input.nextRunAtMs] : due;
}

export function overlapDisposition(
  policy: "skip" | "queue",
  hasActiveRun: boolean,
): "start" | "queue" | "skip" {
  if (!hasActiveRun) return "start";
  return policy;
}

export function restartRunDisposition(input: {
  readonly threadExists: boolean;
  readonly turnState: string | null;
  readonly sessionStatus: string | null;
}): "keep-running" | "succeeded" | "failed" {
  if (!input.threadExists) return "failed";
  if (input.turnState === "error" || input.sessionStatus === "error") return "failed";
  if (
    input.turnState !== null &&
    input.turnState !== "running" &&
    input.sessionStatus !== "running" &&
    input.sessionStatus !== "starting"
  ) {
    return "succeeded";
  }
  return "keep-running";
}
