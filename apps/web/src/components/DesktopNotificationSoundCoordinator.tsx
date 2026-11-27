import type { DesktopNotificationSound, OrchestrationV2RunStatus } from "@kairo/contracts";
import type { EnvironmentThreadShell } from "@kairo/client-runtime/state/shell";
import { useEffect, useRef } from "react";

import { useAllEnvironmentShellsBootstrapped, useThreadShells } from "../state/entities";

export interface SessionNotificationThread {
  readonly sessionStatus: NonNullable<EnvironmentThreadShell["runtime"]>["status"] | null;
  readonly turnId: string | null;
  readonly turnState: OrchestrationV2RunStatus | null;
  readonly completedAt: string | null;
}

export type SessionNotificationSnapshot = ReadonlyMap<string, SessionNotificationThread>;

function terminalNotification(
  thread: SessionNotificationThread,
): { readonly key: string; readonly sound: DesktopNotificationSound } | null {
  if (
    thread.completedAt === null ||
    thread.turnId === null ||
    thread.sessionStatus === null ||
    thread.sessionStatus === "preparing" ||
    thread.sessionStatus === "queued" ||
    thread.sessionStatus === "starting" ||
    thread.sessionStatus === "waiting" ||
    thread.sessionStatus === "running"
  ) {
    return null;
  }

  if (thread.turnState === "completed") {
    return {
      key: `${thread.turnId}\u0000completed\u0000${thread.completedAt}`,
      sound: "success",
    };
  }
  if (thread.turnState === "failed" && thread.sessionStatus === "failed") {
    return {
      key: `${thread.turnId}\u0000error\u0000${thread.completedAt}`,
      sound: "error",
    };
  }
  return null;
}

export function sessionNotificationSounds(
  previous: SessionNotificationSnapshot,
  current: SessionNotificationSnapshot,
): ReadonlyArray<DesktopNotificationSound> {
  const sounds: DesktopNotificationSound[] = [];
  for (const [threadKey, currentThread] of current) {
    const previousThread = previous.get(threadKey);
    if (previousThread === undefined) continue;

    const notification = terminalNotification(currentThread);
    if (notification === null) continue;
    if (notification.key !== terminalNotification(previousThread)?.key) {
      sounds.push(notification.sound);
    }
  }
  return sounds;
}

export function DesktopNotificationSoundCoordinator() {
  const threads = useThreadShells();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const previousRef = useRef<SessionNotificationSnapshot | null>(null);

  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- synchronizes desktop sound playback with completed runs
  useEffect(() => {
    if (!bootstrapped) {
      previousRef.current = null;
      return;
    }

    const current = new Map<string, SessionNotificationThread>();
    for (const thread of threads) {
      current.set(`${thread.environmentId}\u0000${thread.id}`, {
        sessionStatus: thread.runtime?.status ?? null,
        turnId: thread.latestRun?.runId ?? null,
        turnState: thread.latestRun?.status ?? null,
        completedAt: thread.latestRun?.completedAt ?? null,
      });
    }

    const previous = previousRef.current;
    previousRef.current = current;
    if (previous === null) return;

    const playNotificationSound = window.desktopBridge?.playNotificationSound;
    if (playNotificationSound === undefined) return;
    for (const sound of sessionNotificationSounds(previous, current)) {
      void playNotificationSound(sound).catch(() => undefined);
    }
  }, [bootstrapped, threads]);

  return null;
}
