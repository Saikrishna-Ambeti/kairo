import { describe, expect, it } from "vite-plus/test";

import {
  dueOccurrences,
  nextScheduledOccurrence,
  overlapDisposition,
  parseCron,
  restartRunDisposition,
  zonedMinute,
} from "./schedule.ts";

describe("scheduled-task clock", () => {
  it("finds hourly, weekday, and cron occurrences deterministically", () => {
    expect(
      nextScheduledOccurrence({
        trigger: { kind: "hourly", minute: 45 },
        timeZone: "UTC",
        afterMs: Date.parse("2026-08-21T10:40:00.000Z"),
      }),
    ).toBe(Date.parse("2026-08-21T10:45:00.000Z"));
    expect(
      nextScheduledOccurrence({
        trigger: { kind: "weekdays", time: "09:00" },
        timeZone: "UTC",
        afterMs: Date.parse("2026-08-21T10:00:00.000Z"),
      }),
    ).toBe(Date.parse("2026-08-24T09:00:00.000Z"));
    expect(parseCron("*/15 8-10 * * 1-5")).not.toBeNull();
    expect(parseCron("not cron")).toBeNull();
  });

  it("handles spring-forward and repeated fall-back minutes", () => {
    expect(
      nextScheduledOccurrence({
        trigger: { kind: "daily", time: "02:30" },
        timeZone: "America/New_York",
        afterMs: Date.parse("2026-03-08T05:00:00.000Z"),
      }),
    ).toBe(Date.parse("2026-03-09T06:30:00.000Z"));
    const firstFall = Date.parse("2026-11-01T05:30:00.000Z");
    expect(zonedMinute(firstFall, "America/New_York").key).toBe("2026-11-01 01:30");
    expect(
      nextScheduledOccurrence({
        trigger: { kind: "daily", time: "01:30" },
        timeZone: "America/New_York",
        afterMs: firstFall,
        dedupeLocalKey: "2026-11-01 01:30",
      }),
    ).toBe(Date.parse("2026-11-02T06:30:00.000Z"));
  });

  it("applies sleep recovery policies", () => {
    const base = Date.parse("2026-08-23T08:00:00.000Z");
    const input = {
      trigger: { kind: "hourly" as const, minute: 0 },
      timeZone: "UTC",
      nextRunAtMs: base,
      nowMs: base + 3 * 60 * 60_000,
    };
    expect(dueOccurrences({ ...input, missedRuns: "skip" })).toEqual([base]);
    expect(dueOccurrences({ ...input, missedRuns: "catch-up-once" })).toEqual([
      base + 3 * 60 * 60_000,
    ]);
    expect(dueOccurrences({ ...input, missedRuns: "catch-up-all" })).toHaveLength(4);
  });

  it("makes overlap and restart recovery explicit", () => {
    expect(overlapDisposition("skip", true)).toBe("skip");
    expect(overlapDisposition("queue", true)).toBe("queue");
    expect(overlapDisposition("skip", false)).toBe("start");
    expect(
      restartRunDisposition({ threadExists: false, turnState: null, sessionStatus: null }),
    ).toBe("failed");
    expect(
      restartRunDisposition({ threadExists: true, turnState: "running", sessionStatus: "running" }),
    ).toBe("keep-running");
    expect(
      restartRunDisposition({ threadExists: true, turnState: "completed", sessionStatus: "idle" }),
    ).toBe("succeeded");
  });
});
