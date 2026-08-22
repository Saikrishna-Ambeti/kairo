import { describe, expect, it } from "vite-plus/test";

import {
  type SessionNotificationSnapshot,
  type SessionNotificationThread,
  sessionNotificationSounds,
} from "./DesktopNotificationSoundCoordinator";

const running: SessionNotificationThread = {
  sessionStatus: "running",
  turnId: "turn-1",
  turnState: "running",
  completedAt: null,
};

function snapshot(
  thread: SessionNotificationThread,
  key = "environment-1\u0000thread-1",
): SessionNotificationSnapshot {
  return new Map([[key, thread]]);
}

describe("session notification sounds", () => {
  it("plays success when a running turn completes", () => {
    expect(
      sessionNotificationSounds(
        snapshot(running),
        snapshot({
          sessionStatus: "ready",
          turnId: "turn-1",
          turnState: "completed",
          completedAt: "2026-08-22T08:00:00.000Z",
        }),
      ),
    ).toEqual(["success"]);
  });

  it("waits for the session to leave running after the final message arrives", () => {
    expect(
      sessionNotificationSounds(
        snapshot(running),
        snapshot({
          sessionStatus: "running",
          turnId: "turn-1",
          turnState: "completed",
          completedAt: "2026-08-22T08:00:00.000Z",
        }),
      ),
    ).toEqual([]);
  });

  it("plays error only after the session reaches its final error state", () => {
    const retrying = snapshot({
      ...running,
      sessionStatus: "starting",
    });
    expect(sessionNotificationSounds(snapshot(running), retrying)).toEqual([]);
    expect(
      sessionNotificationSounds(
        retrying,
        snapshot({
          sessionStatus: "error",
          turnId: "turn-1",
          turnState: "error",
          completedAt: "2026-08-22T08:00:00.000Z",
        }),
      ),
    ).toEqual(["error"]);
  });

  it("stays silent for interrupted sessions", () => {
    expect(
      sessionNotificationSounds(
        snapshot(running),
        snapshot({
          sessionStatus: "interrupted",
          turnId: "turn-1",
          turnState: "interrupted",
          completedAt: "2026-08-22T08:00:00.000Z",
        }),
      ),
    ).toEqual([]);
  });

  it("does not replay a terminal notification", () => {
    const completed = snapshot({
      sessionStatus: "ready",
      turnId: "turn-1",
      turnState: "completed",
      completedAt: "2026-08-22T08:00:00.000Z",
    });
    expect(sessionNotificationSounds(completed, completed)).toEqual([]);
  });

  it("ignores terminal state loaded for a newly discovered thread", () => {
    const completed = snapshot({
      sessionStatus: "ready",
      turnId: "turn-1",
      turnState: "completed",
      completedAt: "2026-08-22T08:00:00.000Z",
    });
    expect(sessionNotificationSounds(new Map(), completed)).toEqual([]);
  });

  it("detects a completed turn even when updates skip the running render", () => {
    expect(
      sessionNotificationSounds(
        snapshot({
          sessionStatus: "ready",
          turnId: "turn-1",
          turnState: "completed",
          completedAt: "2026-08-22T08:00:00.000Z",
        }),
        snapshot({
          sessionStatus: "ready",
          turnId: "turn-2",
          turnState: "completed",
          completedAt: "2026-08-22T08:01:00.000Z",
        }),
      ),
    ).toEqual(["success"]);
  });
});
