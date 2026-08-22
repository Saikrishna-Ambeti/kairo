import "../../index.css";

import {
  DEFAULT_PRODUCT_SURFACE_CONFIG,
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ComposioStatus,
  type LocalApi,
  type ServerConfig,
  type ServerProvider,
  type SupermemoryStatus,
} from "@kairo/contracts";
import { page } from "vite-plus/test/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { __resetLocalApiForTests } from "../../localApi";
import { AppAtomRegistryProvider, resetAppAtomRegistryForTests } from "../../rpc/atomRegistry";
import { resetServerStateForTests, setServerConfigSnapshot } from "../../rpc/serverState";
import { OnboardingGate } from "./OnboardingGate";

const memoryStatus: SupermemoryStatus = {
  enabled: false,
  mode: "hosted",
  scope: "user",
  auth: { hasApiKey: false },
  providers: [],
};

const composioStatus: ComposioStatus = {
  enabled: false,
  endpoint: "https://connect.composio.dev/mcp",
  auth: { status: "not_configured", hasApiKey: false },
  agentSupport: [],
};

function provider(input: Partial<ServerProvider> = {}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: false,
    version: null,
    status: "error",
    auth: { status: "unknown" },
    checkedAt: "2026-08-21T00:00:00.000Z",
    message: "Codex CLI (`codex`) is not installed or not on PATH.",
    models: [],
    slashCommands: [],
    skills: [],
    versionAdvisory: {
      status: "unknown",
      currentVersion: null,
      latestVersion: null,
      updateCommand: "npm install -g @openai/codex@latest",
      canUpdate: true,
      checkedAt: "2026-08-21T00:00:00.000Z",
      message: null,
    },
    ...input,
  };
}

function serverConfig(providers: ReadonlyArray<ServerProvider>): ServerConfig {
  return {
    environment: {
      environmentId: EnvironmentId.make("environment-local"),
      label: "Local environment",
      platform: { os: "darwin", arch: "arm64" },
      serverVersion: "0.0.0-test",
      capabilities: { repositoryIdentity: true },
    },
    auth: {
      policy: "loopback-browser",
      bootstrapMethods: ["one-time-token"],
      sessionMethods: ["browser-session-cookie", "bearer-access-token"],
      sessionCookieName: "kairo_session",
    },
    cwd: "/repo/project",
    keybindingsConfigPath: "/repo/project/.kairo-keybindings.json",
    keybindings: [],
    issues: [],
    surface: DEFAULT_PRODUCT_SURFACE_CONFIG,
    providers,
    availableEditors: [],
    observability: {
      logsDirectoryPath: "/repo/project/.kairo/logs",
      localTracingEnabled: false,
      otlpTracesUrl: "http://localhost:4318/v1/traces",
      otlpTracesEnabled: false,
      otlpMetricsEnabled: false,
    },
    settings: DEFAULT_SERVER_SETTINGS,
  };
}

describe("OnboardingGate provider installation", () => {
  beforeEach(async () => {
    Reflect.deleteProperty(window, "nativeApi");
    resetAppAtomRegistryForTests();
    resetServerStateForTests();
    await __resetLocalApiForTests();
  });

  afterEach(async () => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(window, "nativeApi");
    resetServerStateForTests();
    await __resetLocalApiForTests();
    resetAppAtomRegistryForTests();
  });

  it("shows progress and actionable output when provider install fails", async () => {
    let currentProvider = provider();
    let finishInstall: (payload: { providers: ReadonlyArray<ServerProvider> }) => void = () => {};
    const installPromise = new Promise<{ providers: ReadonlyArray<ServerProvider> }>((resolve) => {
      finishInstall = resolve;
    });
    const updateProvider = vi.fn<LocalApi["server"]["updateProvider"]>(() => installPromise);

    window.nativeApi = {
      server: {
        refreshProviders: vi.fn(async () => ({ providers: [currentProvider] })),
        getMemoryStatus: vi.fn(async () => memoryStatus),
        getComposioStatus: vi.fn(async () => composioStatus),
        updateProvider,
      },
    } as unknown as LocalApi;
    setServerConfigSnapshot(serverConfig([currentProvider]));

    render(
      <AppAtomRegistryProvider>
        <OnboardingGate onComplete={vi.fn()} />
      </AppAtomRegistryProvider>,
    );

    const installButton = page.getByRole("button", { name: "Install", exact: true });
    await expect.element(installButton).toBeEnabled();
    await installButton.click();

    await expect
      .element(page.getByRole("progressbar", { name: "Codex installation progress" }))
      .toBeInTheDocument();
    await expect.element(page.getByText("Starting installer")).toBeInTheDocument();

    currentProvider = provider({
      updateState: {
        status: "failed",
        startedAt: "2026-08-21T00:00:00.000Z",
        finishedAt: "2026-08-21T00:00:01.000Z",
        message: "Update command exited with code 1.",
        output: "npm permission denied",
      },
    });
    setServerConfigSnapshot(serverConfig([currentProvider]));
    finishInstall({ providers: [currentProvider] });

    await expect.element(page.getByRole("button", { name: "Retry install" })).toBeEnabled();
    await expect.element(page.getByText(/Fix the installer error and retry/)).toBeInTheDocument();
    await expect.element(page.getByText("Could not install Codex")).toBeInTheDocument();
  });
});
