import { DEFAULT_SERVER_SETTINGS } from "@kairo/contracts";
import { describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ChildProcessSpawner } from "effect/unstable/process";
import { HostProcessPlatform } from "@kairo/shared/hostProcess";

import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../provider/providerMaintenance.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { ProcessRunner, type ProcessRunInput, type ProcessRunOutput } from "../processRunner.ts";
import { ComposioService, makeComposioService } from "./ComposioService.ts";

function ok(stdout = "", stderr = ""): ProcessRunOutput {
  return {
    stdout,
    stderr,
    code: ChildProcessSpawner.ExitCode(0),
    timedOut: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    stdoutInvalidUtf8: false,
    stderrInvalidUtf8: false,
  };
}

function failed(stderr: string): ProcessRunOutput {
  return {
    ...ok(),
    stderr,
    code: ChildProcessSpawner.ExitCode(1),
  };
}

function makeTestDeps(
  run: (input: ProcessRunInput) => Effect.Effect<ProcessRunOutput, never, never>,
  composioSettings: Partial<typeof DEFAULT_SERVER_SETTINGS.integrations.composio> = {},
  hostPlatform: NodeJS.Platform = "linux",
) {
  return Layer.mergeAll(
    NodeServices.layer,
    ServerSettingsService.layerTest({
      integrations: {
        composio: {
          ...DEFAULT_SERVER_SETTINGS.integrations.composio,
          ...composioSettings,
        },
      },
    }),
    Layer.succeed(ProcessRunner, ProcessRunner.of({ run })),
    Layer.succeed(HostProcessPlatform, hostPlatform),
    Layer.mock(ProviderRegistry)({
      getProviders: Effect.succeed([]),
      refresh: () => Effect.succeed([]),
      refreshInstance: () => Effect.succeed([]),
      getProviderMaintenanceCapabilitiesForInstance: (_instanceId, provider) =>
        Effect.succeed(
          makeManualOnlyProviderMaintenanceCapabilities({ provider, packageName: null }),
        ),
      setProviderMaintenanceActionState: () => Effect.succeed([]),
      streamChanges: Stream.empty,
    }),
  );
}

describe("ComposioService", () => {
  it.effect("parses toolkit catalog JSON without turning object fields into apps", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/kairo-composio-test-catalog";
      const runMock = vi.fn((input: ProcessRunInput) =>
        Effect.sync(() => {
          if (input.command === "composio" && input.args[0] === "--version") {
            return ok("composio 1.0.0\n");
          }
          if (input.args.join(" ") === "dev toolkits list --limit 200") {
            return ok(`{
              "data": {
                "items": [
                  {
                    "slug": "gmail",
                    "name": "Gmail",
                    "description": "Gmail is Google email.",
                    "tools_count": 61,
                    "triggers_count": 2
                  }
                ]
              }
            }`);
          }
          return ok();
        }),
      );

      const TestDeps = makeTestDeps(runMock, { enabled: true, preferredToolkits: [] });

      const ComposioTest = Layer.effect(ComposioService, makeComposioService).pipe(
        Layer.provide(TestDeps),
      );

      try {
        const catalog = yield* Effect.gen(function* () {
          const composio = yield* ComposioService;
          return yield* composio.listToolkits({ limit: 200 });
        }).pipe(Effect.provide(ComposioTest));

        expect(catalog.items).toEqual([
          expect.objectContaining({
            toolkit: "gmail",
            label: "Gmail",
            description: "Gmail is Google email.",
            toolsCount: 61,
            triggersCount: 2,
          }),
        ]);
      } finally {
        if (previousInstallDir === undefined) {
          delete process.env.COMPOSIO_INSTALL_DIR;
        } else {
          process.env.COMPOSIO_INSTALL_DIR = previousInstallDir;
        }
      }
    }),
  );

  it.effect("reports only connected Composio toolkits in status", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/kairo-composio-test-connected";
      const runMock = vi.fn((input: ProcessRunInput) =>
        Effect.sync(() => {
          if (input.command === "composio" && input.args[0] === "--version") {
            return ok("composio 1.0.0\n");
          }
          if (input.command === "composio" && input.args[0] === "whoami") {
            return ok('{"email":"user@example.com"}');
          }
          if (input.command === "composio" && input.args.join(" ") === "link gmail --list") {
            return ok(
              '{"toolkit":"gmail","total":1,"items":[{"toolkit":{"slug":"gmail"},"word_id":"gmail_main-douse","status":"ACTIVE"}]}',
            );
          }
          if (input.command === "composio" && input.args.join(" ") === "link slack --list") {
            return ok(
              '{"toolkit":"slack","total":1,"items":[{"toolkit":{"slug":"slack"},"alias":"work","status":"ACTIVE"}]}',
            );
          }
          if (
            input.command === "composio" &&
            input.args.join(" ") === "dev connected-accounts list --limit 100"
          ) {
            return ok(
              '{"items":[{"toolkit":{"slug":"slack","name":"Slack"},"status":"ACTIVE","alias":"work"},{"toolkit":{"slug":"notion","name":"Notion"},"status":"FAILED"}]}',
            );
          }
          return ok();
        }),
      );

      const TestDeps = makeTestDeps(runMock, {
        enabled: true,
        preferredToolkits: ["slack", "gmail"],
      });

      const ComposioTest = Layer.effect(ComposioService, makeComposioService).pipe(
        Layer.provide(TestDeps),
      );

      try {
        const status = yield* Effect.gen(function* () {
          const composio = yield* ComposioService;
          return yield* composio.getStatus;
        }).pipe(Effect.provide(ComposioTest));

        expect(status.toolkits).toEqual([
          expect.objectContaining({
            toolkit: "slack",
            connectionStatus: "connected",
          }),
          expect.objectContaining({
            toolkit: "gmail",
            connectionStatus: "connected",
          }),
        ]);
      } finally {
        if (previousInstallDir === undefined) {
          delete process.env.COMPOSIO_INSTALL_DIR;
        } else {
          process.env.COMPOSIO_INSTALL_DIR = previousInstallDir;
        }
      }
    }),
  );

  it.effect("skips CLI install when install-and-login re-check discovers composio", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/kairo-composio-test-missing";
      const runs: ProcessRunInput[] = [];
      const runMock = vi.fn((input: ProcessRunInput) =>
        Effect.sync(() => {
          runs.push(input);
          if (input.command === "composio" && input.args[0] === "--version") {
            return ok("composio 1.0.0\n");
          }
          if (input.command === "composio" && input.args[0] === "login") {
            return ok("Open https://app.composio.dev/login\n");
          }
          if (input.command === "composio" && input.args[0] === "whoami") {
            return ok('{"email":"user@example.com"}');
          }
          return ok();
        }),
      );

      const TestDeps = makeTestDeps(runMock, { enabled: false });

      const ComposioTest = Layer.effect(ComposioService, makeComposioService).pipe(
        Layer.provide(TestDeps),
      );

      try {
        const status = yield* Effect.gen(function* () {
          const composio = yield* ComposioService;
          yield* composio
            .installAndLogin({ providerInstanceIds: [] })
            .pipe(Stream.take(1), Stream.runCollect);
          for (let index = 0; index < 20; index += 1) {
            yield* Effect.yieldNow;
          }
          return yield* composio.getStatus;
        }).pipe(Effect.provide(ComposioTest));

        expect(status.operation).toMatchObject({
          kind: "install_and_login",
          status: "succeeded",
        });
        expect(runs).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ command: "composio", args: ["--version"] }),
            expect.objectContaining({ command: "composio", args: ["login"] }),
            expect.objectContaining({ command: "composio", args: ["whoami"] }),
          ]),
        );
        expect(runs.some((run) => run.command === "bash" || run.command === "powershell.exe")).toBe(
          false,
        );
      } finally {
        if (previousInstallDir === undefined) {
          delete process.env.COMPOSIO_INSTALL_DIR;
        } else {
          process.env.COMPOSIO_INSTALL_DIR = previousInstallDir;
        }
      }
    }),
  );

  it.effect("reports native Windows as unsupported instead of running npm install", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/kairo-composio-test-windows";
      const runs: ProcessRunInput[] = [];
      const runMock = vi.fn((input: ProcessRunInput) =>
        Effect.sync(() => {
          runs.push(input);
          return failed("not found");
        }),
      );
      const ComposioTest = Layer.effect(ComposioService, makeComposioService).pipe(
        Layer.provide(makeTestDeps(runMock, {}, "win32")),
      );

      try {
        const status = yield* Effect.gen(function* () {
          const composio = yield* ComposioService;
          return yield* composio.getStatus;
        }).pipe(Effect.provide(ComposioTest));

        expect(status).toMatchObject({
          primaryAction: "none",
          cli: {
            status: "unsupported",
            platform: "win32",
            installCommandLabel: "WSL: curl -fsSL https://composio.dev/install | sh",
          },
        });
        expect(status.cli.message).toContain("Run Kairo in WSL");
        expect(runs.some((run) => run.command === "powershell.exe" || run.command === "npm")).toBe(
          false,
        );
      } finally {
        if (previousInstallDir === undefined) {
          delete process.env.COMPOSIO_INSTALL_DIR;
        } else {
          process.env.COMPOSIO_INSTALL_DIR = previousInstallDir;
        }
      }
    }),
  );

  it.effect("keeps installer output on a failed setup operation", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/kairo-composio-test-install-failure";
      const runMock = vi.fn((input: ProcessRunInput) =>
        Effect.sync(() =>
          input.command === "bash"
            ? failed("curl: (6) Could not resolve host: composio.dev")
            : failed("composio not found"),
        ),
      );
      const ComposioTest = Layer.effect(ComposioService, makeComposioService).pipe(
        Layer.provide(makeTestDeps(runMock)),
      );

      try {
        const result = yield* Effect.gen(function* () {
          const composio = yield* ComposioService;
          const events = yield* composio
            .installAndLogin({ providerInstanceIds: [] })
            .pipe(Stream.runCollect);
          const status = yield* composio.getStatus;
          return { events: Array.from(events), status };
        }).pipe(Effect.provide(ComposioTest));

        expect(result.status.operation).toMatchObject({
          status: "failed",
          errorDetail: "curl: (6) Could not resolve host: composio.dev",
        });
        expect(result.events.at(-1)).toMatchObject({
          stage: "Failed",
          stderr: "curl: (6) Could not resolve host: composio.dev",
        });
      } finally {
        if (previousInstallDir === undefined) {
          delete process.env.COMPOSIO_INSTALL_DIR;
        } else {
          process.env.COMPOSIO_INSTALL_DIR = previousInstallDir;
        }
      }
    }),
  );
});
