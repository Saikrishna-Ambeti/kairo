import type { DesktopNotificationSound } from "@kairo/contracts";
import { HostProcessPlatform } from "@kairo/shared/hostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

import * as Electron from "electron";

export interface SystemNotificationSoundCommand {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
}

export function systemNotificationSoundCommand(
  platform: NodeJS.Platform,
  sound: DesktopNotificationSound,
): SystemNotificationSoundCommand | null {
  switch (platform) {
    case "win32":
      return {
        executable: "powershell.exe",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          sound === "success"
            ? "[System.Media.SystemSounds]::Asterisk.Play()"
            : "[System.Media.SystemSounds]::Hand.Play()",
        ],
      };
    case "darwin":
      return {
        executable: "/usr/bin/afplay",
        args: [
          sound === "success"
            ? "/System/Library/Sounds/Glass.aiff"
            : "/System/Library/Sounds/Basso.aiff",
        ],
      };
    case "linux":
      return {
        executable: "canberra-gtk-play",
        args: ["--id", sound === "success" ? "complete" : "dialog-error"],
      };
    default:
      return null;
  }
}

export class ElectronNotificationSound extends Context.Service<
  ElectronNotificationSound,
  {
    readonly play: (sound: DesktopNotificationSound) => Effect.Effect<void>;
  }
>()("@kairo/desktop/electron/ElectronNotificationSound") {}

export const make = Effect.gen(function* () {
  const platform = yield* HostProcessPlatform;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const beep = Effect.sync(() => Electron.shell.beep());

  const play = Effect.fn("ElectronNotificationSound.play")(function* (
    sound: DesktopNotificationSound,
  ) {
    const commandSpec = systemNotificationSoundCommand(platform, sound);
    if (commandSpec === null) {
      return yield* beep;
    }

    const command = ChildProcess.make(commandSpec.executable, commandSpec.args, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = yield* spawner.exitCode(command).pipe(Effect.option);
    if (exitCode._tag === "None" || Number(exitCode.value) !== 0) {
      yield* beep;
    }
  });

  return ElectronNotificationSound.of({ play });
});

export const layer = Layer.effect(ElectronNotificationSound, make);
