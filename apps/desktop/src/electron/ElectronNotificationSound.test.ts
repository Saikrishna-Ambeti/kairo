import { assert, describe, it } from "@effect/vitest";
import type { DesktopNotificationSound } from "@kairo/contracts";
import { HostProcessPlatform } from "@kairo/shared/hostProcess";
import * as Effect from "effect/Effect";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { beforeEach, vi } from "vite-plus/test";

const { beepMock } = vi.hoisted(() => ({ beepMock: vi.fn() }));

vi.mock("electron", () => ({ shell: { beep: beepMock } }));

import * as ElectronNotificationSound from "./ElectronNotificationSound.ts";

interface RecordedCommand {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
}

function runSound(input: {
  readonly platform: NodeJS.Platform;
  readonly sound: DesktopNotificationSound;
  readonly exitCode?: number;
  readonly commands?: RecordedCommand[];
}) {
  const spawner = ChildProcessSpawner.ChildProcessSpawner.of({
    exitCode: (
      command: Parameters<ChildProcessSpawner.ChildProcessSpawner["Service"]["exitCode"]>[0],
    ) =>
      Effect.sync(() => {
        const value = command as unknown as {
          readonly command: string;
          readonly args: ReadonlyArray<string>;
        };
        input.commands?.push({ executable: value.command, args: value.args });
        return ChildProcessSpawner.ExitCode(input.exitCode ?? 0);
      }),
  } as unknown as ChildProcessSpawner.ChildProcessSpawner["Service"]);

  return Effect.gen(function* () {
    const notificationSound = yield* ElectronNotificationSound.make;
    yield* notificationSound.play(input.sound);
  }).pipe(
    Effect.provideService(HostProcessPlatform, input.platform),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
  );
}

describe("ElectronNotificationSound", () => {
  beforeEach(() => {
    beepMock.mockReset();
  });

  it.effect("uses distinct Windows system sounds for success and error", () => {
    const commands: RecordedCommand[] = [];
    return Effect.gen(function* () {
      yield* runSound({ platform: "win32", sound: "success", commands });
      yield* runSound({ platform: "win32", sound: "error", commands });

      assert.deepEqual(commands, [
        {
          executable: "powershell.exe",
          args: [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[System.Media.SystemSounds]::Asterisk.Play()",
          ],
        },
        {
          executable: "powershell.exe",
          args: [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[System.Media.SystemSounds]::Hand.Play()",
          ],
        },
      ]);
      assert.equal(beepMock.mock.calls.length, 0);
    });
  });

  it("uses distinct macOS system sounds", () => {
    assert.deepEqual(
      ElectronNotificationSound.systemNotificationSoundCommand("darwin", "success"),
      {
        executable: "/usr/bin/afplay",
        args: ["/System/Library/Sounds/Glass.aiff"],
      },
    );
    assert.deepEqual(ElectronNotificationSound.systemNotificationSoundCommand("darwin", "error"), {
      executable: "/usr/bin/afplay",
      args: ["/System/Library/Sounds/Basso.aiff"],
    });
  });

  it("uses freedesktop sound events on Linux", () => {
    assert.deepEqual(ElectronNotificationSound.systemNotificationSoundCommand("linux", "success"), {
      executable: "canberra-gtk-play",
      args: ["--id", "complete"],
    });
    assert.deepEqual(ElectronNotificationSound.systemNotificationSoundCommand("linux", "error"), {
      executable: "canberra-gtk-play",
      args: ["--id", "dialog-error"],
    });
  });

  it.effect("falls back to Electron's system beep when native playback fails", () =>
    Effect.gen(function* () {
      yield* runSound({ platform: "linux", sound: "success", exitCode: 127 });
      assert.equal(beepMock.mock.calls.length, 1);
    }),
  );
});
