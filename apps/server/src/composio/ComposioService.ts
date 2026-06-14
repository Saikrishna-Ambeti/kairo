import * as NodeOS from "node:os";
import { randomUUID } from "node:crypto";

import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  ComposioError,
  type ComposioAgentSupportStatus,
  type ComposioCliState,
  type ComposioOperation,
  type ComposioOperationKind,
  type ComposioOperationProgressEvent,
  type ComposioPlatform,
  type ComposioPrimaryAction,
  type ComposioStatus,
  type ComposioToolkitCatalog,
  type ComposioToolkitCatalogItem,
  type ComposioToolkitCategory,
  type ComposioToolkitStatus,
  type InstallComposioAgentSupportInput,
  type InstallComposioInput,
  type LinkComposioToolkitInput,
  type ListComposioToolkitsInput,
  type ProviderInstanceId,
  ServerSettingsError,
} from "@kairo/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import {
  ProcessRunner,
  layer as ProcessRunnerLive,
  type ProcessRunOutput,
} from "../processRunner.ts";

type ComposioServiceError = ComposioError | ServerSettingsError;

export interface ComposioServiceShape {
  readonly getStatus: Effect.Effect<ComposioStatus, ComposioServiceError, never>;
  readonly listToolkits: (
    input: ListComposioToolkitsInput,
  ) => Effect.Effect<ComposioToolkitCatalog, ComposioServiceError, never>;
  readonly installAndLogin: (
    input: InstallComposioInput,
  ) => Stream.Stream<ComposioOperationProgressEvent, ComposioServiceError, never>;
  readonly login: (
    input: InstallComposioInput,
  ) => Stream.Stream<ComposioOperationProgressEvent, ComposioServiceError, never>;
  readonly linkToolkit: (
    input: LinkComposioToolkitInput,
  ) => Stream.Stream<ComposioOperationProgressEvent, ComposioServiceError, never>;
  readonly installAgentSupport: (
    input: InstallComposioAgentSupportInput,
  ) => Effect.Effect<ComposioStatus, ComposioServiceError, never>;
  readonly disable: Effect.Effect<ComposioStatus, ComposioServiceError, never>;
}

export class ComposioService extends Context.Service<ComposioService, ComposioServiceShape>()(
  "kairo/composio/ComposioService",
) {}

const TOOLKIT_META: Readonly<
  Record<string, { readonly label: string; readonly category: ComposioToolkitCategory }>
> = {
  slack: { label: "Slack", category: "communication" },
  notion: { label: "Notion", category: "productivity" },
  gmail: { label: "Gmail", category: "google-workspace" },
  googlecalendar: { label: "Google Calendar", category: "google-workspace" },
  googledrive: { label: "Google Drive", category: "google-workspace" },
  googlesheets: { label: "Google Sheets", category: "google-workspace" },
  googledocs: { label: "Google Docs", category: "google-workspace" },
};

const FALLBACK_TOOLKIT_CATALOG: readonly ComposioToolkitCatalogItem[] = [
  {
    toolkit: "slack",
    label: "Slack",
    category: "Communication",
    description: "Send messages, search conversations, and work with Slack channels.",
  },
  {
    toolkit: "notion",
    label: "Notion",
    category: "Productivity",
    description: "Create, search, and update pages and databases.",
  },
  {
    toolkit: "gmail",
    label: "Gmail",
    category: "Google Workspace",
    description: "Read, search, draft, and send email.",
  },
  {
    toolkit: "googlecalendar",
    label: "Google Calendar",
    category: "Google Workspace",
    description: "Find, create, and update calendar events.",
  },
  {
    toolkit: "googledrive",
    label: "Google Drive",
    category: "Google Workspace",
    description: "Search and manage files in Drive.",
  },
  {
    toolkit: "googlesheets",
    label: "Google Sheets",
    category: "Google Workspace",
    description: "Read and update spreadsheets.",
  },
  {
    toolkit: "googledocs",
    label: "Google Docs",
    category: "Google Workspace",
    description: "Create, read, and update documents.",
  },
  {
    toolkit: "github",
    label: "GitHub",
    category: "Developer Tools",
    description: "Work with repositories, issues, pull requests, and users.",
  },
  {
    toolkit: "linear",
    label: "Linear",
    category: "Project Management",
    description: "Search, create, and update issues and projects.",
  },
  {
    toolkit: "hubspot",
    label: "HubSpot",
    category: "CRM",
    description: "Manage contacts, companies, deals, and CRM activity.",
  },
];

const CONNECTED_ACCOUNT_DISCOVERY_TOOLKITS = [
  ...new Set([
    ...Object.keys(TOOLKIT_META),
    ...FALLBACK_TOOLKIT_CATALOG.map((item) => item.toolkit),
  ]),
] as const;

const decodeUnknownJsonString = Schema.decodeEffect(Schema.UnknownFromJsonString);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function numberField(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): number | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
  }
  return undefined;
}

function firstCategoryName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((entry) => isRecord(entry) || typeof entry === "string");
    if (typeof first === "string" && first.trim()) return first.trim();
    if (isRecord(first)) return stringField(first, ["name", "id"]);
  }
  return undefined;
}

function normalizeCatalogItem(value: unknown): ComposioToolkitCatalogItem | null {
  if (!isRecord(value)) return null;
  const meta = isRecord(value.meta) ? value.meta : {};
  const toolkit = stringField(value, ["slug", "toolkit", "key", "id"]);
  const label = stringField(value, ["name", "label", "display_name"]) ?? toolkit;
  if (!toolkit || !label) return null;
  const category =
    firstCategoryName(meta.categories) ??
    firstCategoryName(value.categories) ??
    stringField(value, ["category"]);
  return {
    toolkit,
    label,
    ...(category ? { category } : {}),
    ...((stringField(meta, ["description"]) ?? stringField(value, ["description"]))
      ? {
          description:
            stringField(meta, ["description"]) ?? stringField(value, ["description"]) ?? "",
        }
      : {}),
    ...((stringField(meta, ["logo", "logo_url"]) ?? stringField(value, ["logo", "logo_url"]))
      ? {
          logoUrl:
            stringField(meta, ["logo", "logo_url"]) ??
            stringField(value, ["logo", "logo_url"]) ??
            "",
        }
      : {}),
    ...((stringField(meta, ["app_url"]) ?? stringField(value, ["app_url"]))
      ? { appUrl: stringField(meta, ["app_url"]) ?? stringField(value, ["app_url"]) ?? "" }
      : {}),
    ...((numberField(meta, ["tools_count"]) ?? numberField(value, ["tools_count"]))
      ? {
          toolsCount:
            numberField(meta, ["tools_count"]) ?? numberField(value, ["tools_count"]) ?? 0,
        }
      : {}),
    ...((numberField(meta, ["triggers_count"]) ?? numberField(value, ["triggers_count"]))
      ? {
          triggersCount:
            numberField(meta, ["triggers_count"]) ?? numberField(value, ["triggers_count"]) ?? 0,
        }
      : {}),
  };
}

function catalogItemsFromUnknown(value: unknown): ComposioToolkitCatalogItem[] {
  const items: ComposioToolkitCatalogItem[] = [];
  const visit = (entry: unknown, depth: number) => {
    if (depth > 6) return;
    const item = normalizeCatalogItem(entry);
    if (item) {
      items.push(item);
      return;
    }
    if (Array.isArray(entry)) {
      for (const child of entry) visit(child, depth + 1);
      return;
    }
    if (!isRecord(entry)) return;
    for (const key of [
      "items",
      "data",
      "toolkits",
      "results",
      "toolkit_versions",
      "toolkitVersions",
    ]) {
      visit(entry[key], depth + 1);
    }
  };
  visit(value, 0);
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toolkit.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function looksLikeJsonOutput(output: string): boolean {
  const trimmed = output.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    /^\s*["[{]/m.test(output) ||
    /"\s*:\s*/.test(output)
  );
}

function catalogItemsFromTable(output: string): ComposioToolkitCatalogItem[] {
  if (looksLikeJsonOutput(output)) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-+\s|]+$/.test(line) && !/^slug\b/i.test(line))
    .flatMap((line) => {
      const clean = line.replaceAll(/[│|]/g, " ").trim();
      const parts = clean.split(/\s{2,}/).filter(Boolean);
      const toolkit = parts[0]?.trim();
      if (
        !toolkit ||
        /toolkit|name|category/i.test(toolkit) ||
        !/^[a-z][a-z0-9_-]{1,80}$/i.test(toolkit)
      )
        return [];
      return [
        {
          toolkit,
          label: parts[1]?.trim() || toolkit,
          ...(parts[2]?.trim() ? { category: parts[2].trim() } : {}),
        } satisfies ComposioToolkitCatalogItem,
      ];
    });
}

function toolkitMeta(toolkit: string): {
  readonly label: string;
  readonly category: ComposioToolkitCategory;
} {
  return TOOLKIT_META[toolkit.toLowerCase()] ?? { label: toolkit, category: "other" as const };
}

function connectedStatusFor(
  toolkit: string,
  accountLabel?: string,
  message?: string,
): ComposioToolkitStatus {
  const meta = toolkitMeta(toolkit);
  return {
    toolkit,
    label: meta.label,
    category: meta.category,
    connectionStatus: "connected",
    ...(accountLabel ? { accountLabel } : {}),
    ...(message ? { message } : {}),
  };
}

function nestedRecord(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  for (const field of fields) {
    const value = record[field];
    if (isRecord(value)) return value;
  }
  return undefined;
}

function toolkitSlugFromConnectedAccount(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return undefined;
  const direct = stringField(value, [
    "toolkit",
    "toolkit_slug",
    "toolkitSlug",
    "app",
    "app_slug",
    "appSlug",
    "slug",
  ]);
  if (direct) return direct;
  const nested = nestedRecord(value, [
    "toolkit",
    "toolkit_info",
    "toolkitInfo",
    "app",
    "auth_config",
    "authConfig",
  ]);
  if (!nested) return undefined;
  return (
    stringField(nested, ["slug", "toolkit", "toolkit_slug", "toolkitSlug", "key", "id"]) ??
    toolkitSlugFromConnectedAccount(nested.toolkit)
  );
}

function connectedAccountLabel(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringField(value, [
    "alias",
    "word_id",
    "wordId",
    "account_label",
    "accountLabel",
    "email",
    "name",
    "user_id",
    "userId",
    "id",
  ]);
}

function connectedAccountLooksActive(value: unknown): boolean {
  if (!isRecord(value)) return true;
  const status = stringField(value, ["status", "state", "connection_status", "connectionStatus"]);
  if (!status) return true;
  return /active|connected|enabled|success|initiated/i.test(status);
}

function connectedToolkitsFromUnknown(value: unknown): ComposioToolkitStatus[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];
  const seen = new Set<string>();
  return rawItems.flatMap((entry) => {
    if (!connectedAccountLooksActive(entry)) return [];
    const toolkit = toolkitSlugFromConnectedAccount(entry);
    if (!toolkit) return [];
    const key = toolkit.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [connectedStatusFor(toolkit, connectedAccountLabel(entry))];
  });
}

function connectedToolkitsFromTable(output: string): ComposioToolkitStatus[] {
  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-+\s|]+$/.test(line));
  const seen = new Set<string>();
  let headers: string[] | null = null;
  const connected: ComposioToolkitStatus[] = [];

  for (const row of rows) {
    const parts = row.includes("|")
      ? row
          .split(/[│|]/)
          .map((part) => part.trim())
          .filter(Boolean)
      : row.split(/\s{2,}/).map((part) => part.trim());
    if (parts.length === 0) continue;
    const lowerParts = parts.map((part) => part.toLowerCase());
    if (lowerParts.some((part) => /toolkit|app|status|state/.test(part))) {
      headers = lowerParts;
      continue;
    }

    let toolkit: string | undefined;
    let status: string | undefined;
    let accountLabel: string | undefined;
    if (headers) {
      const rowRecord = Object.fromEntries(
        headers.map((header, index) => [header.replaceAll(/\s+/g, "_"), parts[index]]),
      );
      toolkit = stringField(rowRecord, ["toolkit", "toolkit_slug", "app", "app_slug", "slug"]);
      status = stringField(rowRecord, ["status", "state", "connection_status"]);
      accountLabel = stringField(rowRecord, ["alias", "email", "account", "account_id", "id"]);
    } else {
      toolkit = parts.find((part) => /^[a-z][a-z0-9_-]+$/i.test(part));
    }
    if (!toolkit) continue;
    if (status && !/active|connected|enabled|success|initiated/i.test(status)) continue;
    const key = toolkit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    connected.push(connectedStatusFor(toolkit, accountLabel));
  }
  return connected;
}

function platform(): ComposioPlatform {
  if (
    process.platform === "darwin" ||
    process.platform === "linux" ||
    process.platform === "win32"
  ) {
    return process.platform;
  }
  return "other";
}

function installCommandLabel(): string {
  if (process.platform === "win32") {
    return "PowerShell: npm install -g @composio/cli";
  }
  return "curl -fsSL https://composio.dev/install | bash";
}

function installedPathCandidate(path: Path.Path): string {
  const exe = process.platform === "win32" ? "composio.exe" : "composio";
  return path.join(
    process.env.COMPOSIO_INSTALL_DIR || path.join(NodeOS.homedir(), ".composio"),
    exe,
  );
}

function authUrlFromOutput(output: string): string | undefined {
  return output.match(/https:\/\/[^\s"'<>]+/)?.[0];
}

function redact(output: string): string {
  return output
    .replaceAll(/(key|token|secret|api[_-]?key)(=|:)\S+/gi, "$1$2[redacted]")
    .slice(0, 12_000);
}

function accountLabelFromWhoami(output: string): string | undefined {
  const trimmed = output.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of ["email", "user_email", "userId", "user_id", "id"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    // Plain text output is acceptable; keep only a compact first line.
  }
  return trimmed
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0)
    ?.trim()
    .slice(0, 120);
}

function providerMessage(driver: string, cliAvailable: boolean): string {
  if (!cliAvailable)
    return "Install and sign in to the Composio CLI before this provider can use tools.";
  if (driver === "codex") return "Composio CLI is available to Codex through PATH.";
  if (driver === "claudeAgent")
    return "Composio CLI is available; run agent support install to add Claude skill guidance.";
  return "Composio CLI is available through PATH. Native skill discovery is not verified for this provider yet.";
}

export const makeComposioService = Effect.gen(function* () {
  const serverSettings = yield* ServerSettingsService;
  const providerRegistry = yield* ProviderRegistry;
  const processRunner = yield* ProcessRunner;
  const fileSystem = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const events = yield* Effect.acquireRelease(
    PubSub.unbounded<ComposioOperationProgressEvent>(),
    PubSub.shutdown,
  );
  const operationRef = yield* Ref.make<ComposioOperation | undefined>(undefined);
  const statusCacheRef = yield* Ref.make<ComposioStatus | undefined>(undefined);
  const statusRefreshRunningRef = yield* Ref.make(false);

  const nowIso = DateTime.now.pipe(Effect.map(DateTime.formatIso));

  const run = (
    command: string,
    args: ReadonlyArray<string>,
    timeout: Duration.Input = Duration.seconds(20),
  ): Effect.Effect<ProcessRunOutput, ComposioError, never> =>
    processRunner
      .run({
        command,
        args,
        timeout,
        maxOutputBytes: 80_000,
        outputMode: "truncate",
        timeoutBehavior: "timedOutResult",
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new ComposioError({
              message: `Failed to run ${command}.`,
              cause,
            }),
        ),
      );

  const resolveExecutable: Effect.Effect<string | null, never> = Effect.gen(function* () {
    const candidate = installedPathCandidate(pathService);
    const exists = yield* fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false));
    if (exists) {
      return candidate;
    }
    const result = yield* run("composio", ["--version"]).pipe(Effect.result);
    if (Result.isSuccess(result) && result.success.code === 0) return "composio";
    return null;
  });

  const probeCli: Effect.Effect<ComposioCliState, never> = Effect.gen(function* () {
    const checkedAt = yield* nowIso;
    const executable = yield* resolveExecutable;
    if (!executable) {
      return {
        status: process.platform === "win32" ? "missing" : "missing",
        platform: platform(),
        installCommandLabel: installCommandLabel(),
        lastCheckedAt: checkedAt,
        message: "Composio CLI is not installed on this backend.",
      } satisfies ComposioCliState;
    }
    const version = yield* run(executable, ["--version"]).pipe(
      Effect.map((result) =>
        result.code === 0 ? result.stdout.trim() || result.stderr.trim() : undefined,
      ),
      Effect.orElseSucceed(() => undefined),
    );
    return {
      status: "needs_login",
      platform: platform(),
      installCommandLabel: installCommandLabel(),
      executablePath: executable,
      ...(version ? { version } : {}),
      lastCheckedAt: checkedAt,
    } satisfies ComposioCliState;
  });

  const probeAuth = (
    executable: string | undefined,
  ): Effect.Effect<ComposioStatus["auth"], never> =>
    Effect.gen(function* () {
      if (!executable) return { status: "unknown" as const };
      const result = yield* run(executable, ["whoami"]).pipe(Effect.result);
      if (Result.isFailure(result)) return { status: "unknown" as const };
      if (result.success.code !== 0) return { status: "unauthenticated" as const };
      const accountLabel = accountLabelFromWhoami(result.success.stdout || result.success.stderr);
      return {
        status: "authenticated" as const,
        ...(accountLabel ? { accountLabel } : {}),
      };
    });

  const primaryActionFor = (
    cli: ComposioCliState,
    authStatus: "authenticated" | "unauthenticated" | "unknown",
  ): ComposioPrimaryAction => {
    if (cli.status === "missing" || cli.status === "unsupported" || cli.status === "error")
      return "install_and_login";
    if (authStatus !== "authenticated") return "login";
    return "none";
  };

  const listConsumerConnectedToolkits = (
    executable: string,
    candidates: ReadonlyArray<string>,
  ): Effect.Effect<ComposioToolkitStatus[], never> =>
    Effect.gen(function* () {
      const seenCandidates = new Set<string>();
      const connected: ComposioToolkitStatus[] = [];
      for (const candidate of candidates) {
        const toolkit = candidate.trim().toLowerCase();
        if (!toolkit || seenCandidates.has(toolkit)) continue;
        seenCandidates.add(toolkit);
        const result = yield* run(
          executable,
          ["link", toolkit, "--list"],
          Duration.seconds(20),
        ).pipe(Effect.result);
        if (Result.isFailure(result) || result.success.code !== 0) continue;
        const output = result.success.stdout || result.success.stderr;
        const parsed = yield* decodeUnknownJsonString(output).pipe(Effect.result);
        const items = Result.isSuccess(parsed)
          ? connectedToolkitsFromUnknown(parsed.success)
          : connectedToolkitsFromTable(output);
        connected.push(...items);
      }

      const seenConnected = new Set<string>();
      return connected.filter((toolkit) => {
        const key = toolkit.toolkit.toLowerCase();
        if (seenConnected.has(key)) return false;
        seenConnected.add(key);
        return true;
      });
    });

  const listProjectConnectedToolkits = (
    executable: string | undefined,
  ): Effect.Effect<ComposioToolkitStatus[], never> =>
    Effect.gen(function* () {
      if (!executable) return [];

      const result = yield* run(
        executable,
        ["dev", "connected-accounts", "list", "--limit", "100"],
        Duration.seconds(20),
      ).pipe(Effect.result);
      if (Result.isSuccess(result) && result.success.code === 0) {
        const output = result.success.stdout || result.success.stderr;
        const parsed = yield* decodeUnknownJsonString(output).pipe(Effect.result);
        if (Result.isSuccess(parsed)) {
          const connected = connectedToolkitsFromUnknown(parsed.success);
          if (connected.length > 0) return connected;
        }
        return connectedToolkitsFromTable(output);
      }

      return [];
    });

  const buildStatus = (
    mode: "fast" | "full",
  ): Effect.Effect<ComposioStatus, ComposioServiceError, never> =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      const cli: ComposioCliState = yield* probeCli;
      const auth = yield* probeAuth(cli.executablePath);
      const effectiveCli: ComposioCliState =
        auth.status === "authenticated" ? { ...cli, status: "authenticated" } : cli;
      const persistedConnected = settings.integrations.composio.preferredToolkits.map((toolkit) =>
        connectedStatusFor(toolkit, undefined, "Connected through Composio."),
      );
      const discoveryCandidates = [
        ...CONNECTED_ACCOUNT_DISCOVERY_TOOLKITS,
        ...settings.integrations.composio.preferredToolkits,
      ];
      const consumerConnected =
        mode === "full" && auth.status === "authenticated" && cli.executablePath
          ? yield* listConsumerConnectedToolkits(cli.executablePath, discoveryCandidates)
          : [];
      const projectConnected =
        mode === "full" && auth.status === "authenticated"
          ? yield* listProjectConnectedToolkits(cli.executablePath)
          : [];
      const toolkitMap = new Map<string, ComposioToolkitStatus>();
      for (const toolkit of persistedConnected)
        toolkitMap.set(toolkit.toolkit.toLowerCase(), toolkit);
      for (const toolkit of projectConnected)
        toolkitMap.set(toolkit.toolkit.toLowerCase(), toolkit);
      for (const toolkit of consumerConnected)
        toolkitMap.set(toolkit.toolkit.toLowerCase(), toolkit);
      const toolkits = [...toolkitMap.values()];
      const selectedIds = new Set<ProviderInstanceId>(
        settings.integrations.composio.providerInstanceIds,
      );
      const providers = yield* providerRegistry.getProviders;
      const cliAvailable = Boolean(cli.executablePath);
      const agentSupport: ComposioAgentSupportStatus[] = providers.map((provider) => {
        const selected = selectedIds.has(provider.instanceId);
        const supported = provider.driver === "codex" || provider.driver === "claudeAgent";
        return {
          providerInstanceId: provider.instanceId,
          driver: provider.driver,
          displayName: provider.displayName ?? String(provider.instanceId),
          selected,
          cliAvailable,
          skillStatus: !selected
            ? "needs_install"
            : cliAvailable && supported
              ? "ready"
              : supported
                ? "needs_install"
                : "unsupported",
          message: providerMessage(provider.driver, cliAvailable),
        };
      });
      const operation = yield* Ref.get(operationRef);
      return {
        enabled: settings.integrations.composio.enabled,
        primaryAction: primaryActionFor(effectiveCli, auth.status),
        cli: effectiveCli,
        auth,
        toolkits,
        agentSupport,
        ...(operation ? { operation } : {}),
      } satisfies ComposioStatus;
    });

  const refreshStatusCache: Effect.Effect<void, never, never> = buildStatus("full").pipe(
    Effect.tap((status) => Ref.set(statusCacheRef, status)),
    Effect.asVoid,
    Effect.catch((error: ComposioServiceError) =>
      Effect.gen(function* () {
        const cached = yield* Ref.get(statusCacheRef);
        if (!cached) return;
        yield* Ref.set(statusCacheRef, {
          ...cached,
          cli: {
            ...cached.cli,
            status: cached.cli.status === "authenticated" ? "authenticated" : "error",
            message: error.message,
          },
        });
      }),
    ),
    Effect.ensuring(Ref.set(statusRefreshRunningRef, false)),
  );

  const startStatusRefresh: Effect.Effect<void, never, never> = Effect.gen(function* () {
    const running = yield* Ref.get(statusRefreshRunningRef);
    if (running) return;
    yield* Ref.set(statusRefreshRunningRef, true);
    yield* refreshStatusCache.pipe(Effect.forkDetach);
  });

  const getStatus: Effect.Effect<ComposioStatus, ComposioServiceError, never> = Effect.gen(
    function* () {
      const cached = yield* Ref.get(statusCacheRef);
      if (cached) {
        yield* startStatusRefresh;
        return cached;
      }
      const fastStatus = yield* buildStatus("fast");
      yield* Ref.set(statusCacheRef, fastStatus);
      yield* startStatusRefresh;
      return fastStatus;
    },
  );

  const fallbackCatalog = (
    input: ListComposioToolkitsInput,
    message: string,
  ): ComposioToolkitCatalog => {
    const query = input.search?.trim().toLowerCase();
    const items = FALLBACK_TOOLKIT_CATALOG.filter(
      (item) =>
        !query ||
        item.toolkit.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    ).slice(0, Math.max(1, input.limit));
    return {
      items,
      source: "fallback",
      message,
    };
  };

  const listToolkits: ComposioServiceShape["listToolkits"] = (input) =>
    Effect.gen(function* () {
      const executable = yield* resolveExecutable;
      if (!executable) {
        return fallbackCatalog(
          input,
          "Install and sign in to Composio to load the full app catalog.",
        );
      }

      const query = input.search?.trim();
      const limit = String(Math.min(Math.max(1, input.limit), 1000));
      const args = [
        "dev",
        "toolkits",
        "list",
        ...(query ? ["--query", query] : []),
        "--limit",
        limit,
      ];
      const result = yield* run(executable, args, Duration.seconds(45)).pipe(Effect.result);
      if (Result.isSuccess(result) && result.success.code === 0) {
        const output = result.success.stdout || result.success.stderr;
        const parsed = yield* decodeUnknownJsonString(output).pipe(Effect.result);
        if (Result.isSuccess(parsed)) {
          const items = catalogItemsFromUnknown(parsed.success).slice(0, Number(limit));
          if (items.length > 0) return { items, source: "cli" as const };
        }
        const items = catalogItemsFromTable(output).slice(0, Number(limit));
        if (items.length > 0) return { items, source: "cli" as const };
      }

      return fallbackCatalog(input, "Could not read the full Composio catalog from the CLI.");
    });

  const publish = (
    operation: ComposioOperation,
    stage: string,
    message: string,
    output?: Partial<Pick<ComposioOperationProgressEvent, "stdout" | "stderr" | "authUrl">>,
  ): Effect.Effect<ComposioOperation, never, never> =>
    Effect.gen(function* () {
      const updatedAt = yield* nowIso;
      const next = { ...operation, updatedAt, message };
      yield* Ref.set(operationRef, next);
      yield* PubSub.publish(events, {
        type: "progress",
        operation: next,
        stage,
        message,
        ...(output?.stdout ? { stdout: redact(output.stdout) } : {}),
        ...(output?.stderr ? { stderr: redact(output.stderr) } : {}),
        ...(output?.authUrl ? { authUrl: output.authUrl } : {}),
      });
      return next;
    });

  const installCli = (operation: ComposioOperation): Effect.Effect<string, ComposioServiceError> =>
    Effect.gen(function* () {
      const executable = yield* resolveExecutable;
      if (executable) {
        yield* publish(operation, "Checking CLI", "Composio CLI is already installed.");
        return executable;
      }
      let result: ProcessRunOutput;
      if (process.platform === "win32") {
        const script = [
          "$ErrorActionPreference = 'Stop'",
          "if (Get-Command composio -ErrorAction SilentlyContinue) { exit 0 }",
          "if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required for native Windows Composio CLI install. Install Node.js/npm or use WSL.' }",
          "npm install -g @composio/cli",
        ].join("; ");
        operation = yield* publish(
          operation,
          "Installing CLI",
          "Installing Composio CLI with PowerShell.",
        );
        result = yield* run(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
          Duration.minutes(10),
        );
      } else {
        operation = yield* publish(operation, "Installing CLI", "Installing Composio CLI.");
        result = yield* run(
          "bash",
          ["-lc", "curl -fsSL https://composio.dev/install | bash"],
          Duration.minutes(10),
        );
      }
      if (result.code !== 0 || result.timedOut) {
        return yield* new ComposioError({
          message: result.timedOut
            ? "Composio CLI install timed out."
            : "Composio CLI install failed.",
          cause: redact(result.stderr || result.stdout),
        });
      }
      yield* publish(operation, "Installing CLI", "Composio CLI install finished.", {
        stdout: result.stdout,
        stderr: result.stderr,
      });
      const nextExecutable = yield* resolveExecutable;
      if (!nextExecutable) {
        return yield* new ComposioError({
          message: "Composio CLI was installed but could not be found.",
        });
      }
      return nextExecutable;
    });

  const loginCli = (
    operation: ComposioOperation,
    executable: string,
  ): Effect.Effect<void, ComposioServiceError> =>
    Effect.gen(function* () {
      operation = yield* publish(operation, "Signing in", "Opening Composio sign-in flow.");
      const result = yield* run(executable, ["login"], Duration.minutes(10));
      const authUrl = authUrlFromOutput(`${result.stdout}\n${result.stderr}`);
      if (result.code !== 0 || result.timedOut) {
        yield* publish(operation, "Signing in", "Composio login needs attention.", {
          stdout: result.stdout,
          stderr: result.stderr,
          ...(authUrl ? { authUrl } : {}),
        });
        return yield* new ComposioError({
          message: result.timedOut ? "Composio login timed out." : "Composio login failed.",
          cause: redact(result.stderr || result.stdout),
        });
      }
      operation = yield* publish(operation, "Verifying account", "Verifying Composio account.", {
        stdout: result.stdout,
        stderr: result.stderr,
        ...(authUrl ? { authUrl } : {}),
      });
      const whoami = yield* run(executable, ["whoami"], Duration.seconds(20));
      if (whoami.code !== 0) {
        return yield* new ComposioError({
          message: "Composio login finished, but account verification failed.",
        });
      }
    });

  const runOperation = (
    kind: ComposioOperationKind,
    task: (operation: ComposioOperation) => Effect.Effect<void, ComposioServiceError, never>,
  ): Effect.Effect<ComposioOperation, never, never> =>
    Effect.gen(function* () {
      const existing = yield* Ref.get(operationRef);
      if (existing?.status === "running") return existing;
      const startedAt = yield* nowIso;
      const operation: ComposioOperation = {
        id: randomUUID(),
        kind,
        status: "running",
        startedAt,
        updatedAt: startedAt,
        message: "Starting Composio setup.",
      };
      yield* Ref.set(operationRef, operation);
      yield* PubSub.publish(events, {
        type: "progress",
        operation,
        stage: "Checking CLI",
        message: "Checking Composio CLI.",
      });
      yield* task(operation).pipe(
        Effect.tap(() =>
          Effect.gen(function* () {
            const updatedAt = yield* nowIso;
            const current = (yield* Ref.get(operationRef)) ?? operation;
            const completed = {
              ...current,
              status: "succeeded" as const,
              updatedAt,
              message: "Composio setup completed.",
            };
            yield* Ref.set(operationRef, completed);
            yield* PubSub.publish(events, {
              type: "progress",
              operation: completed,
              stage: "Complete",
              message: completed.message ?? "Composio setup completed.",
            });
          }),
        ),
        Effect.catch((error: ComposioServiceError) =>
          Effect.gen(function* () {
            const updatedAt = yield* nowIso;
            const current = (yield* Ref.get(operationRef)) ?? operation;
            const failed = {
              ...current,
              status: "failed" as const,
              updatedAt,
              message: error.message,
            };
            yield* Ref.set(operationRef, failed);
            yield* PubSub.publish(events, {
              type: "progress",
              operation: failed,
              stage: "Failed",
              message: error.message,
            });
          }),
        ),
        Effect.forkDetach,
      );
      return operation;
    });

  const operationStream = (
    start: Effect.Effect<ComposioOperation, never, never>,
  ): Stream.Stream<ComposioOperationProgressEvent, never, never> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const initial = yield* start;
        const liveEvents = Stream.fromPubSub(events).pipe(
          Stream.filter((event) => event.operation.id === initial.id),
        );
        const terminalEventFromState = Stream.fromEffectSchedule(
          Ref.get(operationRef),
          Schedule.spaced(Duration.millis(250)),
        ).pipe(
          Stream.filter(
            (operation): operation is ComposioOperation =>
              operation?.id === initial.id && operation.status !== "running",
          ),
          Stream.map((operation) => ({
            type: "progress" as const,
            operation,
            stage: operation.status === "succeeded" ? "Complete" : "Failed",
            message: operation.message ?? "Composio operation finished.",
          })),
        );
        return Stream.concat(
          Stream.make({
            type: "progress" as const,
            operation: initial,
            stage: initial.status === "running" ? "Checking CLI" : "Status",
            message: initial.message ?? "Composio operation is running.",
          }),
          Stream.merge(liveEvents, terminalEventFromState).pipe(
            Stream.takeUntil((event) => event.operation.status !== "running"),
          ),
        );
      }),
    );

  const installAndLogin: ComposioServiceShape["installAndLogin"] = (input) =>
    operationStream(
      runOperation("install_and_login", (operation) =>
        Effect.gen(function* () {
          yield* serverSettings.updateSettings({
            integrations: {
              composio: { enabled: true, providerInstanceIds: input.providerInstanceIds },
            },
          });
          const executable = yield* installCli(operation);
          yield* loginCli(operation, executable);
          yield* publish(
            operation,
            "Installing agent support",
            "Installing Composio agent support.",
          );
        }),
      ),
    );

  const login: ComposioServiceShape["login"] = (input) =>
    operationStream(
      runOperation("login", (operation) =>
        Effect.gen(function* () {
          yield* serverSettings.updateSettings({
            integrations: {
              composio: { enabled: true, providerInstanceIds: input.providerInstanceIds },
            },
          });
          const executable = yield* resolveExecutable;
          if (!executable)
            return yield* new ComposioError({ message: "Composio CLI is not installed." });
          yield* loginCli(operation, executable);
          yield* publish(
            operation,
            "Installing agent support",
            "Installing Composio agent support.",
          );
        }),
      ),
    );

  const linkToolkit: ComposioServiceShape["linkToolkit"] = (input) =>
    operationStream(
      runOperation("link_toolkit", (operation) =>
        Effect.gen(function* () {
          const executable = yield* resolveExecutable;
          if (!executable)
            return yield* new ComposioError({ message: "Composio CLI is not installed." });
          const result = yield* run(executable, ["link", input.toolkit], Duration.minutes(10));
          const authUrl = authUrlFromOutput(`${result.stdout}\n${result.stderr}`);
          yield* publish(operation, "Signing in", `Connecting ${input.toolkit}.`, {
            stdout: result.stdout,
            stderr: result.stderr,
            ...(authUrl ? { authUrl } : {}),
          });
          if (result.code !== 0 || result.timedOut) {
            return yield* new ComposioError({ message: `Could not connect ${input.toolkit}.` });
          }
          const settings = yield* serverSettings.getSettings;
          const connectedToolkits = new Set(settings.integrations.composio.preferredToolkits);
          connectedToolkits.add(input.toolkit);
          yield* serverSettings.updateSettings({
            integrations: {
              composio: {
                enabled: true,
                preferredToolkits: [...connectedToolkits],
              },
            },
          });
          yield* startStatusRefresh;
        }),
      ),
    );

  const installAgentSupport: ComposioServiceShape["installAgentSupport"] = (input) =>
    Effect.gen(function* () {
      yield* serverSettings.updateSettings({
        integrations: {
          composio: { enabled: true, providerInstanceIds: input.providerInstanceIds },
        },
      });
      yield* Ref.set(statusCacheRef, undefined);
      const status = yield* buildStatus("fast");
      yield* Ref.set(statusCacheRef, status);
      yield* startStatusRefresh;
      return status;
    });

  const disable = Effect.gen(function* () {
    yield* serverSettings.updateSettings({
      integrations: { composio: { enabled: false, providerInstanceIds: [] } },
    });
    yield* Ref.set(statusCacheRef, undefined);
    const status = yield* buildStatus("fast");
    yield* Ref.set(statusCacheRef, status);
    return status;
  });

  return {
    getStatus,
    listToolkits,
    installAndLogin,
    login,
    linkToolkit,
    installAgentSupport,
    disable,
  } satisfies ComposioServiceShape;
});

export const ComposioServiceLive = Layer.effect(ComposioService, makeComposioService).pipe(
  Layer.provide(ProcessRunnerLive),
  Layer.provide(NodeServices.layer),
);
