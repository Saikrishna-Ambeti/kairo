import {
  type ProviderDriverKind,
  type ProviderInstanceConfigMap,
  type ProviderInstanceId,
  type SupermemoryProviderStatus,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";

import { ProcessRunner, type ProcessRunnerShape } from "../processRunner.ts";
import type { CodexSupermemoryIntegrationState } from "./SupermemoryCodexIntegration.ts";
import { isSupermemoryDriverSupported } from "./SupermemoryProviderBindings.ts";
import { redactSupermemorySecrets } from "./SupermemorySecrets.ts";

const CODEX_DRIVER = "codex" as ProviderDriverKind;
const CLAUDE_DRIVER = "claudeAgent" as ProviderDriverKind;
const OPENCODE_DRIVER = "opencode" as ProviderDriverKind;

function codexHomeFromConfig(config: unknown): string | undefined {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return undefined;
  }
  const homePath = (config as { readonly homePath?: unknown }).homePath;
  return typeof homePath === "string" && homePath.trim().length > 0 ? homePath : undefined;
}

export function providerInstallGuidance(driver: ProviderDriverKind): string {
  if (driver === CLAUDE_DRIVER) {
    return "Hosted Supermemory may require a paid plan for Claude Code. To use the Claude integration, install the plugin with `/plugin marketplace add supermemoryai/claude-supermemory`, then `/plugin install claude-supermemory`.";
  }
  if (driver === OPENCODE_DRIVER) {
    return "Hosted Supermemory may require a paid plan for OpenCode. To use the OpenCode integration, run `bunx opencode-supermemory@latest install --no-tui`, then restart OpenCode.";
  }
  return "This provider does not have a verified Supermemory integration path yet.";
}

export function computeProviderMemoryStatus(input: {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly displayName: string;
  readonly selected: boolean;
  readonly hasApiKey: boolean;
  readonly codexIntegration?: CodexSupermemoryIntegrationState | undefined;
}): SupermemoryProviderStatus {
  if (!isSupermemoryDriverSupported(input.driver)) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: input.selected,
      supported: false,
      status: "unsupported",
      message:
        "No reliable Supermemory plugin or MCP install path is configured for this provider.",
    };
  }

  if (!input.selected) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: false,
      supported: true,
      status: "not_selected",
    };
  }

  if (!input.hasApiKey) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: true,
      supported: true,
      status: "needs_action",
      message: "Add a Supermemory API key before this provider can use memory.",
    };
  }

  if (input.driver === CODEX_DRIVER) {
    if (!input.codexIntegration?.scriptsInstalled || !input.codexIntegration.hooksRegistered) {
      return {
        instanceId: input.instanceId,
        driver: input.driver,
        displayName: input.displayName,
        selected: true,
        supported: true,
        status: "needs_install",
        message:
          "Install providers to wire Codex hooks with `npx codex-supermemory@latest install`, then restart Codex.",
      };
    }
    if (!input.codexIntegration.credentialsSynced || !input.codexIntegration.configSynced) {
      return {
        instanceId: input.instanceId,
        driver: input.driver,
        displayName: input.displayName,
        selected: true,
        supported: true,
        status: "needs_action",
        message:
          "Install providers to connect the saved Supermemory key and T3's shared memory space to Codex.",
      };
    }
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: true,
      supported: true,
      status: "ready",
      message: "Codex hooks, credentials, and T3's shared Supermemory space are connected.",
    };
  }

  if (input.driver === OPENCODE_DRIVER) {
    return {
      instanceId: input.instanceId,
      driver: input.driver,
      displayName: input.displayName,
      selected: true,
      supported: true,
      status: "needs_install",
      message: providerInstallGuidance(input.driver),
    };
  }

  return {
    instanceId: input.instanceId,
    driver: input.driver,
    displayName: input.displayName,
    selected: true,
    supported: true,
    status: "needs_action",
    message: providerInstallGuidance(input.driver),
  };
}

const runInstaller = (input: {
  readonly processRunner: ProcessRunnerShape;
  readonly label: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly env?: NodeJS.ProcessEnv;
}) =>
  input.processRunner
    .run({
      command: input.command,
      args: input.args,
      timeout: Duration.minutes(2),
      maxOutputBytes: 20_000,
      outputMode: "truncate",
      ...(input.env ? { env: input.env } : {}),
    })
    .pipe(
      Effect.tap((result) =>
        result.code === 0
          ? Effect.void
          : Effect.logWarning(`${input.label} Supermemory installer exited with failure`, {
              output: redactSupermemorySecrets(result.stderr || result.stdout),
              code: result.code,
            }),
      ),
      Effect.catch((cause) =>
        Effect.logWarning(`${input.label} Supermemory installer failed`, {
          cause: redactSupermemorySecrets(String(cause)),
        }),
      ),
    );

export const installSupermemoryProviders = (input: {
  readonly providerInstanceIds: ReadonlyArray<ProviderInstanceId>;
  readonly configMap: ProviderInstanceConfigMap;
}): Effect.Effect<void, never, ProcessRunner> =>
  Effect.gen(function* () {
    const processRunner = yield* ProcessRunner;
    for (const instanceId of input.providerInstanceIds) {
      const entry = input.configMap[instanceId];
      if (!entry) {
        continue;
      }

      if (entry.driver === CODEX_DRIVER) {
        const codexHome = codexHomeFromConfig(entry.config);
        yield* runInstaller({
          processRunner,
          label: "Codex",
          command: "npx",
          args: ["codex-supermemory@latest", "install"],
          env: {
            ...process.env,
            ...(codexHome ? { CODEX_HOME: codexHome } : {}),
          },
        });
        continue;
      }

      if (entry.driver === OPENCODE_DRIVER) {
        yield* runInstaller({
          processRunner,
          label: "OpenCode",
          command: "bunx",
          args: ["opencode-supermemory@latest", "install", "--no-tui"],
        });
      }
    }
  });
