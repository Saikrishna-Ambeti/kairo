import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopConfig from "./DesktopConfig.ts";

const defaultInput = {
  dirname: "/repo/apps/desktop/dist-electron",
  homeDirectory: "/Users/alice",
  platform: "darwin",
  processArch: "arm64",
  appVersion: "0.0.22",
  appPath: "/Applications/Kairo.app/Contents/Resources/app.asar",
  isPackaged: false,
  resourcesPath: "/Applications/Kairo.app/Contents/Resources",
  runningUnderArm64Translation: false,
} satisfies DesktopEnvironment.MakeDesktopEnvironmentInput;

const makeEnvironmentLayer = (
  overrides: Partial<DesktopEnvironment.MakeDesktopEnvironmentInput> = {},
  env: Record<string, string | undefined> = {},
) =>
  DesktopEnvironment.layer({
    ...defaultInput,
    ...overrides,
  }).pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, DesktopConfig.layerTest(env))));

const makeEnvironment = (
  overrides: Partial<DesktopEnvironment.MakeDesktopEnvironmentInput> = {},
  env: Record<string, string | undefined> = {},
) =>
  DesktopEnvironment.DesktopEnvironment.pipe(Effect.provide(makeEnvironmentLayer(overrides, env)));

describe("DesktopEnvironment", () => {
  it.effect("derives state paths and development identity inside Effect", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment(
        {},
        {
          KAIRO_HOME: " /tmp/kairo ",
          KAIRO_COMMIT_HASH: " 0123456789abcdef ",
          KAIRO_PORT: "4949",
          VITE_DEV_SERVER_URL: "http://localhost:5173",
          KAIRO_DEV_REMOTE_SERVER_ENTRY_PATH: " /remote/server.mjs ",
          KAIRO_OTLP_TRACES_URL: " http://127.0.0.1:4318/v1/traces ",
          KAIRO_OTLP_EXPORT_INTERVAL_MS: "2500",
        },
      );

      assert.equal(environment.isDevelopment, true);
      assert.equal(environment.appDataDirectory, "/Users/alice/Library/Application Support");
      assert.equal(environment.baseDir, "/tmp/kairo");
      assert.equal(environment.stateDir, "/tmp/kairo/dev");
      assert.equal(environment.desktopSettingsPath, "/tmp/kairo/dev/desktop-settings.json");
      assert.equal(environment.clientSettingsPath, "/tmp/kairo/dev/client-settings.json");
      assert.equal(
        environment.savedEnvironmentRegistryPath,
        "/tmp/kairo/dev/saved-environments.json",
      );
      assert.equal(environment.serverSettingsPath, "/tmp/kairo/dev/settings.json");
      assert.equal(environment.logDir, "/tmp/kairo/dev/logs");
      assert.equal(environment.rootDir, "/repo");
      assert.equal(environment.appRoot, "/repo");
      assert.equal(environment.backendEntryPath, "/repo/apps/server/dist/bin.mjs");
      assert.equal(environment.backendCwd, "/repo");
      assert.equal(environment.appUserModelId, "com.kairo.app.dev");
      assert.equal(environment.linuxWmClass, "kairo-dev");
      assert.deepEqual(
        Option.map(environment.devServerUrl, (url) => url.href),
        Option.some("http://localhost:5173/"),
      );
      assert.deepEqual(
        environment.devRemoteKairoServerEntryPath,
        Option.some("/remote/server.mjs"),
      );
      assert.deepEqual(environment.configuredBackendPort, Option.some(4949));
      assert.deepEqual(environment.commitHashOverride, Option.some("0123456789abcdef"));
      assert.deepEqual(environment.otlpTracesUrl, Option.some("http://127.0.0.1:4318/v1/traces"));
      assert.equal(environment.otlpExportIntervalMs, 2500);
    }),
  );

  it.effect("derives production state paths under userdata", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment(
        {},
        {
          KAIRO_HOME: "/tmp/kairo",
        },
      );

      assert.equal(environment.isDevelopment, false);
      assert.equal(environment.stateDir, "/tmp/kairo/userdata");
      assert.equal(environment.logDir, "/tmp/kairo/userdata/logs");
      assert.equal(environment.serverSettingsPath, "/tmp/kairo/userdata/settings.json");
    }),
  );

  it.effect("uses a configured app user model id override", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment(
        {},
        {
          KAIRO_DESKTOP_APP_USER_MODEL_ID: " com.kairo.app.dev.local ",
          VITE_DEV_SERVER_URL: "http://localhost:5173",
        },
      );

      assert.equal(environment.appUserModelId, "com.kairo.app.dev.local");
    }),
  );

  it.effect("resolves picker defaults without nullish sentinels", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment();

      assert.deepEqual(environment.resolvePickFolderDefaultPath(null), Option.none());
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: " " }),
        Option.none(),
      );
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: "~" }),
        Option.some("/Users/alice"),
      );
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: "~/project" }),
        Option.some("/Users/alice/project"),
      );
    }),
  );
});
