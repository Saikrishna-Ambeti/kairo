import * as NodeOS from "node:os";

import type { CodexSettings } from "@kairo/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { expandHomePath } from "../pathExpansion.ts";
import { redactSupermemorySecrets } from "./SupermemorySecrets.ts";

export const KAIRO_SUPERMEMORY_CONTAINER_TAG = "kairo_user_memory";

const CODEX_DIR_NAME = ".codex";
const SUPERMEMORY_DIR_NAME = "supermemory";
const CODEX_SUPERMEMORY_CONFIG_FILE = "supermemory.json";
const CREDENTIALS_FILE = "credentials.json";
const REQUIRED_SCRIPT_NAMES = [
  "recall.js",
  "flush.js",
  "save-memory.js",
  "search-memory.js",
] as const;

const decodeJsonString = Schema.decodeEffect(Schema.UnknownFromJsonString);
const encodeJsonString = Schema.encodeEffect(Schema.UnknownFromJsonString);

export interface CodexSupermemoryIntegrationState {
  readonly homePath: string;
  readonly scriptsInstalled: boolean;
  readonly hooksRegistered: boolean;
  readonly credentialsSynced: boolean;
  readonly configSynced: boolean;
}

function configuredHomePath(config: unknown): string {
  const homePath =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as { readonly homePath?: unknown }).homePath
      : undefined;
  return typeof homePath === "string" ? homePath.trim() : "";
}

const codexHomeFromConfig = Effect.fn("codexHomeFromConfig")(function* (
  config: unknown,
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const raw = configuredHomePath(config);
  return path.resolve(
    raw.length > 0 ? expandHomePath(raw) : path.join(NodeOS.homedir(), CODEX_DIR_NAME),
  );
});

function hookGroupsContainCommand(groups: unknown, command: string): boolean {
  if (!Array.isArray(groups)) return false;
  return groups.some((group) => {
    if (!group || typeof group !== "object") return false;
    const hooks = (group as { readonly hooks?: unknown }).hooks;
    if (!Array.isArray(hooks)) return false;
    return hooks.some((hook) => {
      if (!hook || typeof hook !== "object") return false;
      return (hook as { readonly command?: unknown }).command === command;
    });
  });
}

const readJsonFile = Effect.fn("readJsonFile")(function* (
  filePath: string,
): Effect.fn.Return<unknown | undefined, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(filePath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) return undefined;
  return yield* fs.readFileString(filePath).pipe(
    Effect.flatMap(decodeJsonString),
    Effect.orElseSucceed(() => undefined),
  );
});

const readHooksRegistered = Effect.fn("readHooksRegistered")(function* (
  homePath: string,
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const hooks = yield* readJsonFile(path.join(homePath, "hooks.json"));
  if (!hooks || typeof hooks !== "object") return false;
  const events =
    "hooks" in hooks && hooks.hooks && typeof hooks.hooks === "object" ? hooks.hooks : hooks;
  const supermemoryDir = path.join(homePath, SUPERMEMORY_DIR_NAME);
  const recallCommand = `node ${path.join(supermemoryDir, "recall.js")}`;
  const flushCommand = `node ${path.join(supermemoryDir, "flush.js")}`;
  return (
    hookGroupsContainCommand(
      (events as { readonly UserPromptSubmit?: unknown }).UserPromptSubmit,
      recallCommand,
    ) && hookGroupsContainCommand((events as { readonly Stop?: unknown }).Stop, flushCommand)
  );
});

const readCredentialsSynced = Effect.fn("readCredentialsSynced")(function* (input: {
  readonly homePath: string;
  readonly apiKey: string | undefined;
}): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  if (!input.apiKey) return false;
  const path = yield* Path.Path;
  const credentials = yield* readJsonFile(
    path.join(input.homePath, SUPERMEMORY_DIR_NAME, CREDENTIALS_FILE),
  );
  return (
    !!credentials &&
    typeof credentials === "object" &&
    (credentials as { readonly apiKey?: unknown }).apiKey === input.apiKey
  );
});

const readConfigSynced = Effect.fn("readConfigSynced")(function* (
  homePath: string,
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const config = yield* readJsonFile(path.join(homePath, CODEX_SUPERMEMORY_CONFIG_FILE));
  return (
    !!config &&
    typeof config === "object" &&
    (config as { readonly userContainerTag?: unknown }).userContainerTag ===
      KAIRO_SUPERMEMORY_CONTAINER_TAG &&
    (config as { readonly projectContainerTag?: unknown }).projectContainerTag ===
      KAIRO_SUPERMEMORY_CONTAINER_TAG
  );
});

export const getCodexSupermemoryIntegrationState = Effect.fn("getCodexSupermemoryIntegrationState")(
  function* (input: {
    readonly config: unknown;
    readonly apiKey?: string | undefined;
  }): Effect.fn.Return<CodexSupermemoryIntegrationState, never, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const homePath = yield* codexHomeFromConfig(input.config);
    const dir = path.join(homePath, SUPERMEMORY_DIR_NAME);
    const scriptsInstalled = yield* Effect.all(
      REQUIRED_SCRIPT_NAMES.map((name) =>
        fs.exists(path.join(dir, name)).pipe(Effect.orElseSucceed(() => false)),
      ),
    ).pipe(Effect.map((results) => results.every(Boolean)));
    const hooksRegistered = yield* readHooksRegistered(homePath);
    const credentialsSynced = yield* readCredentialsSynced({
      homePath,
      apiKey: input.apiKey,
    });
    const configSynced = yield* readConfigSynced(homePath);
    return {
      homePath,
      scriptsInstalled,
      hooksRegistered,
      credentialsSynced,
      configSynced,
    };
  },
);

export const syncCodexSupermemoryIntegration = Effect.fn("syncCodexSupermemoryIntegration")(
  function* (input: {
    readonly config: Pick<CodexSettings, "homePath"> | unknown;
    readonly apiKey: string;
  }): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const homePath = yield* codexHomeFromConfig(input.config);
    const dir = path.join(homePath, SUPERMEMORY_DIR_NAME);
    const savedAt = DateTime.formatIso(yield* DateTime.now);

    yield* fs.makeDirectory(dir, { recursive: true }).pipe(
      Effect.tap(() => fs.chmod(dir, 0o700).pipe(Effect.orElseSucceed(() => undefined))),
      Effect.catch((cause) =>
        Effect.logWarning(
          redactSupermemorySecrets(`Failed to create Codex Supermemory directory: ${cause}`),
        ),
      ),
    );

    const credentialsJson = yield* encodeJsonString({
      apiKey: input.apiKey,
      savedAt,
    }).pipe(Effect.orDie);
    const credentialsPath = path.join(dir, CREDENTIALS_FILE);
    yield* fs.writeFileString(credentialsPath, credentialsJson).pipe(
      Effect.tap(() =>
        fs.chmod(credentialsPath, 0o600).pipe(Effect.orElseSucceed(() => undefined)),
      ),
      Effect.catch((cause) =>
        Effect.logWarning(
          redactSupermemorySecrets(`Failed to write Codex Supermemory credentials: ${cause}`),
        ),
      ),
    );

    const configPath = path.join(homePath, CODEX_SUPERMEMORY_CONFIG_FILE);
    const existing = yield* readJsonFile(configPath);
    const next =
      existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
    Object.assign(next, {
      containerTagPrefix: "kairo",
      userContainerTag: KAIRO_SUPERMEMORY_CONTAINER_TAG,
      projectContainerTag: KAIRO_SUPERMEMORY_CONTAINER_TAG,
    });
    const configJson = yield* encodeJsonString(next).pipe(Effect.orDie);
    yield* fs.writeFileString(configPath, `${configJson}\n`).pipe(
      Effect.tap(() => fs.chmod(configPath, 0o600).pipe(Effect.orElseSucceed(() => undefined))),
      Effect.catch((cause) =>
        Effect.logWarning(
          redactSupermemorySecrets(`Failed to write Codex Supermemory config: ${cause}`),
        ),
      ),
    );
  },
);

export const removeSyncedCodexSupermemoryCredentials = Effect.fn(
  "removeSyncedCodexSupermemoryCredentials",
)(function* (input: {
  readonly config: Pick<CodexSettings, "homePath"> | unknown;
  readonly apiKey: string | undefined;
}): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  if (!input.apiKey) return;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const homePath = yield* codexHomeFromConfig(input.config);
  const credentialsPath = path.join(homePath, SUPERMEMORY_DIR_NAME, CREDENTIALS_FILE);
  const credentials = yield* readJsonFile(credentialsPath);
  if (
    credentials &&
    typeof credentials === "object" &&
    (credentials as { readonly apiKey?: unknown }).apiKey === input.apiKey
  ) {
    yield* fs
      .remove(credentialsPath)
      .pipe(
        Effect.catch((cause) =>
          Effect.logWarning(
            redactSupermemorySecrets(`Failed to remove Codex Supermemory credentials: ${cause}`),
          ),
        ),
      );
  }
});
