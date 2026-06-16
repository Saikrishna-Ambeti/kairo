import { DEFAULT_SERVER_SETTINGS } from "@kairo/contracts";
import { describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ChildProcessSpawner } from "effect/unstable/process";

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
  };
}

describe("ComposioService", () => {
  it.effect("parses toolkit catalog JSON without turning object fields into apps", () =>
    Effect.gen(function* () {
      const previousInstallDir = process.env.COMPOSIO_INSTALL_DIR;
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/t3code-composio-test-catalog";
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

      const TestDeps = Layer.mergeAll(
        NodeServices.layer,
        ServerSettingsService.layerTest({
          integrations: {
            composio: {
              ...DEFAULT_SERVER_SETTINGS.integrations.composio,
              enabled: true,
              preferredToolkits: [],
            },
          },
        }),
        Layer.succeed(
          ProcessRunner,
          ProcessRunner.of({
            run: (input) => runMock(input),
          }),
        ),
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
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/t3code-composio-test-connected";
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

      const TestDeps = Layer.mergeAll(
        NodeServices.layer,
        ServerSettingsService.layerTest({
          integrations: {
            composio: {
              ...DEFAULT_SERVER_SETTINGS.integrations.composio,
              enabled: true,
              preferredToolkits: ["slack", "gmail"],
            },
          },
        }),
        Layer.succeed(
          ProcessRunner,
          ProcessRunner.of({
            run: (input) => runMock(input),
          }),
        ),
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
      process.env.COMPOSIO_INSTALL_DIR = "/tmp/t3code-composio-test-missing";
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

      const TestDeps = Layer.mergeAll(
        NodeServices.layer,
        ServerSettingsService.layerTest({
          integrations: {
            composio: {
              ...DEFAULT_SERVER_SETTINGS.integrations.composio,
              enabled: false,
            },
          },
        }),
        Layer.succeed(
          ProcessRunner,
          ProcessRunner.of({
            run: (input) => runMock(input),
          }),
        ),
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
});
