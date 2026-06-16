import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfigMap,
  type ServerSettings,
} from "@kairo/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import {
  getCodexSupermemoryIntegrationState,
  syncCodexSupermemoryIntegration,
  KAIRO_SUPERMEMORY_CONTAINER_TAG,
} from "./SupermemoryCodexIntegration.ts";
import {
  applySupermemoryProviderBindings,
  buildSupermemoryProviderEnvironment,
} from "./SupermemoryProviderBindings.ts";
import {
  computeProviderMemoryStatus,
  installSupermemoryProviders,
  providerInstallGuidance,
} from "./SupermemoryProviderInstaller.ts";
import { redactSupermemorySecrets } from "./SupermemorySecrets.ts";
import { ProcessRunner, type ProcessRunInput } from "../processRunner.ts";

const codexId = ProviderInstanceId.make("codex");
const claudeId = ProviderInstanceId.make("claudeAgent");
const opencodeId = ProviderInstanceId.make("opencode");
const cursorId = ProviderInstanceId.make("cursor");
const codexDriver = ProviderDriverKind.make("codex");
const claudeDriver = ProviderDriverKind.make("claudeAgent");
const opencodeDriver = ProviderDriverKind.make("opencode");
const cursorDriver = ProviderDriverKind.make("cursor");
const decodeJsonString = Schema.decodeEffect(Schema.UnknownFromJsonString);
const encodeJsonString = Schema.encodeEffect(Schema.UnknownFromJsonString);
const NodeServicesTestLayer = NodeServices.layer;

const makeTempCodexHome = Effect.fn("makeTempCodexHome")(function* (): Effect.fn.Return<
  string,
  never,
  FileSystem.FileSystem | Scope.Scope
> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "kairox-supermemory-" }).pipe(Effect.orDie);
});

const writeCodexSupermemoryHooks = Effect.fn("writeCodexSupermemoryHooks")(function* (
  homePath: string,
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const supermemoryDir = path.join(homePath, "supermemory");
  yield* fs.makeDirectory(supermemoryDir, { recursive: true }).pipe(Effect.orDie);
  for (const script of ["recall.js", "flush.js", "save-memory.js", "search-memory.js"]) {
    yield* fs
      .writeFileString(path.join(supermemoryDir, script), "#!/usr/bin/env node\n")
      .pipe(Effect.orDie);
  }
  const encoded = yield* encodeJsonString({
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `node ${path.join(supermemoryDir, "recall.js")}`,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `node ${path.join(supermemoryDir, "flush.js")}`,
            },
          ],
        },
      ],
    },
  }).pipe(Effect.orDie);
  yield* fs.writeFileString(path.join(homePath, "hooks.json"), encoded).pipe(Effect.orDie);
});

const readJsonFile = Effect.fn("readJsonFile")(function* (
  filePath: string,
): Effect.fn.Return<unknown, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(filePath).pipe(Effect.orDie);
  return yield* decodeJsonString(raw).pipe(Effect.orDie);
});

function objectField(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { readonly [key: string]: unknown })[key]
    : undefined;
}

const makeSecretStore = (secret: string | null): ServerSecretStore.ServerSecretStoreShape => {
  const encoded = secret ? new TextEncoder().encode(secret) : null;
  return {
    get: () => Effect.succeed(encoded),
    set: () => Effect.void,
    create: () => Effect.void,
    getOrCreateRandom: () => Effect.succeed(encoded ?? new TextEncoder().encode("sm_generated")),
    remove: () => Effect.void,
  };
};

const withSecretStore = <A, E>(
  effect: Effect.Effect<A, E, ServerSecretStore.ServerSecretStore>,
  secret: string | null,
) =>
  effect.pipe(Effect.provideService(ServerSecretStore.ServerSecretStore, makeSecretStore(secret)));

const makeSettings = (
  overrides: Partial<ServerSettings["memory"]["supermemory"]>,
): ServerSettings => ({
  ...DEFAULT_SERVER_SETTINGS,
  memory: {
    supermemory: {
      ...DEFAULT_SERVER_SETTINGS.memory.supermemory,
      ...overrides,
    },
  },
});

describe("Supermemory secrets", () => {
  it("redacts Supermemory-looking API keys from user-facing text", () => {
    expect(redactSupermemorySecrets("failed with sm_abc123_xyz in stderr")).toBe(
      "failed with sm_*** in stderr",
    );
  });
});

describe("Supermemory provider bindings", () => {
  it("builds hosted Codex bindings without forcing an API URL", () => {
    expect(
      buildSupermemoryProviderEnvironment({
        driver: codexDriver,
        apiKey: "sm_hosted",
      }),
    ).toEqual([{ name: "SUPERMEMORY_CODEX_API_KEY", value: "sm_hosted", sensitive: true }]);
  });

  it("does not expose an API URL binding for hosted provider integrations", () => {
    expect(
      buildSupermemoryProviderEnvironment({
        driver: opencodeDriver,
        apiKey: "sm_hosted",
      }),
    ).toEqual([{ name: "SUPERMEMORY_API_KEY", value: "sm_hosted", sensitive: true }]);
  });

  it.effect("augments only selected supported provider instances", () =>
    Effect.gen(function* () {
      const configMap: ProviderInstanceConfigMap = {
        [codexId]: {
          driver: codexDriver,
          environment: [{ name: "EXISTING", value: "1", sensitive: false }],
        },
        [claudeId]: {
          driver: claudeDriver,
        },
        [cursorId]: {
          driver: cursorDriver,
        },
      };
      const result = yield* withSecretStore(
        applySupermemoryProviderBindings(
          makeSettings({
            enabled: true,
            providerInstanceIds: [codexId, cursorId],
          }),
          configMap,
        ),
        "sm_hosted",
      );

      expect(result[codexId]?.environment).toEqual([
        { name: "EXISTING", value: "1", sensitive: false },
        { name: "SUPERMEMORY_CODEX_API_KEY", value: "sm_hosted", sensitive: true },
      ]);
      expect(result[claudeId]?.environment).toBeUndefined();
      expect(result[cursorId]?.environment).toBeUndefined();
    }),
  );

  it.effect("leaves provider configs unchanged when no API key is available", () =>
    Effect.gen(function* () {
      const configMap: ProviderInstanceConfigMap = {
        [codexId]: {
          driver: codexDriver,
        },
      };

      expect(
        yield* withSecretStore(
          applySupermemoryProviderBindings(
            makeSettings({
              enabled: true,
              providerInstanceIds: [codexId],
            }),
            configMap,
          ),
          null,
        ),
      ).toEqual(configMap);
    }),
  );
});

describe("Supermemory provider installer status", () => {
  it.layer(NodeServicesTestLayer)("Codex integration files", (it) => {
    it.effect("syncs Codex credentials and Kairo's shared memory container config", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const homePath = yield* makeTempCodexHome();
        yield* syncCodexSupermemoryIntegration({
          config: { homePath },
          apiKey: "sm_hosted",
        });

        const state = yield* getCodexSupermemoryIntegrationState({
          config: { homePath },
          apiKey: "sm_hosted",
        });
        expect(state.credentialsSynced).toBe(true);
        expect(state.configSynced).toBe(true);

        const config = yield* readJsonFile(path.join(homePath, "supermemory.json"));
        expect(objectField(config, "userContainerTag")).toBe(KAIRO_SUPERMEMORY_CONTAINER_TAG);
        expect(objectField(config, "projectContainerTag")).toBe(KAIRO_SUPERMEMORY_CONTAINER_TAG);

        const credentials = yield* readJsonFile(
          path.join(homePath, "supermemory", "credentials.json"),
        );
        expect(objectField(credentials, "apiKey")).toBe("sm_hosted");
      }),
    );

    it.effect(
      "does not report Codex ready until hooks and Kairo integration files are present",
      () =>
        Effect.gen(function* () {
          const homePath = yield* makeTempCodexHome();
          expect(
            computeProviderMemoryStatus({
              instanceId: codexId,
              driver: codexDriver,
              displayName: "Codex",
              selected: true,
              hasApiKey: true,
              codexIntegration: yield* getCodexSupermemoryIntegrationState({
                config: { homePath },
                apiKey: "sm_hosted",
              }),
            }),
          ).toMatchObject({ status: "needs_install" });

          yield* writeCodexSupermemoryHooks(homePath);
          yield* syncCodexSupermemoryIntegration({
            config: { homePath },
            apiKey: "sm_hosted",
          });

          expect(
            computeProviderMemoryStatus({
              instanceId: codexId,
              driver: codexDriver,
              displayName: "Codex",
              selected: true,
              hasApiKey: true,
              codexIntegration: yield* getCodexSupermemoryIntegrationState({
                config: { homePath },
                apiKey: "sm_hosted",
              }),
            }),
          ).toMatchObject({ status: "ready" });
        }),
    );
  });

  it.effect("installs Codex hooks with the documented package command", () =>
    Effect.gen(function* () {
      const runs: ProcessRunInput[] = [];
      const processRunner = ProcessRunner.of({
        run: (input) =>
          Effect.sync(() => {
            runs.push(input);
            return {
              stdout: "",
              stderr: "",
              code: ChildProcessSpawner.ExitCode(0),
              timedOut: false,
              stdoutTruncated: false,
              stderrTruncated: false,
            };
          }),
      });
      const configMap: ProviderInstanceConfigMap = {
        [codexId]: {
          driver: codexDriver,
          config: { homePath: "/tmp/codex-home" },
        },
        [claudeId]: {
          driver: claudeDriver,
        },
      };

      yield* installSupermemoryProviders({
        providerInstanceIds: [codexId, claudeId],
        configMap,
      }).pipe(Effect.provideService(ProcessRunner, processRunner));

      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        command: "npx",
        args: ["codex-supermemory@latest", "install"],
      });
      expect(runs[0]?.env?.CODEX_HOME).toBe("/tmp/codex-home");
    }),
  );

  it("reports unsupported providers without install actions", () => {
    expect(
      computeProviderMemoryStatus({
        instanceId: cursorId,
        driver: cursorDriver,
        displayName: "Cursor",
        selected: true,
        hasApiKey: true,
      }),
    ).toMatchObject({
      supported: false,
      status: "unsupported",
    });
  });

  it("explains provider-specific non-Codex Supermemory setup tradeoffs", () => {
    expect(providerInstallGuidance(claudeDriver)).toContain(
      "Hosted Supermemory may require a paid plan",
    );
    expect(providerInstallGuidance(claudeDriver)).toContain("/plugin install claude-supermemory");

    expect(providerInstallGuidance(opencodeDriver)).toContain(
      "Hosted Supermemory may require a paid plan",
    );
    expect(providerInstallGuidance(opencodeDriver)).toContain("opencode-supermemory@latest");
  });

  it.effect("installs OpenCode with the documented non-interactive package command", () =>
    Effect.gen(function* () {
      const runs: ProcessRunInput[] = [];
      const processRunner = ProcessRunner.of({
        run: (input) =>
          Effect.sync(() => {
            runs.push(input);
            return {
              stdout: "",
              stderr: "",
              code: ChildProcessSpawner.ExitCode(0),
              timedOut: false,
              stdoutTruncated: false,
              stderrTruncated: false,
            };
          }),
      });
      const configMap: ProviderInstanceConfigMap = {
        [opencodeId]: {
          driver: opencodeDriver,
        },
      };

      yield* installSupermemoryProviders({
        providerInstanceIds: [opencodeId],
        configMap,
      }).pipe(Effect.provideService(ProcessRunner, processRunner));

      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        command: "bunx",
        args: ["opencode-supermemory@latest", "install", "--no-tui"],
      });
    }),
  );

  it("asks for a hosted API key when provider bindings are missing credentials", () => {
    expect(
      computeProviderMemoryStatus({
        instanceId: codexId,
        driver: codexDriver,
        displayName: "Codex",
        selected: true,
        hasApiKey: false,
      }).message,
    ).toContain("Add a Supermemory API key");
  });
});
