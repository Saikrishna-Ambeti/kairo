import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfigMap,
  type ServerSettings,
} from "@kairo/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { KairoCloudClient } from "../cloud/KairoCloudClient.ts";
import { KAIRO_CLOUD_ACCESS_TOKEN_SECRET } from "../memory/SupermemorySecrets.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../provider/providerMaintenance.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { buildComposioAcpMcpServers, buildComposioCodexArgs } from "./ComposioMcp.ts";
import { COMPOSIO_ACCESS_TOKEN_SECRET } from "./ComposioSecrets.ts";
import {
  applyComposioProviderBindings,
  buildComposioProviderEnvironment,
  COMPOSIO_AUTHORIZATION_ENV,
  COMPOSIO_MCP_URL_ENV,
} from "./ComposioProviderBindings.ts";
import { makeComposioService } from "./ComposioService.ts";

const codexId = ProviderInstanceId.make("codex");
const claudeId = ProviderInstanceId.make("claudeAgent");
const opencodeId = ProviderInstanceId.make("opencode");
const codexDriver = ProviderDriverKind.make("codex");
const claudeDriver = ProviderDriverKind.make("claudeAgent");
const opencodeDriver = ProviderDriverKind.make("opencode");

function makeSecretStore(initial: Readonly<Record<string, string>> = {}) {
  const secrets = new Map<string, Uint8Array>(
    Object.entries(initial).map(([name, value]) => [name, new TextEncoder().encode(value)]),
  );
  return ServerSecretStore.ServerSecretStore.of({
    get: (name) => Effect.succeed(Option.fromNullishOr(secrets.get(name))),
    set: (name, value) => Effect.sync(() => void secrets.set(name, value)),
    create: () => Effect.void,
    getOrCreateRandom: () => Effect.succeed(new TextEncoder().encode("generated-secret")),
    remove: (name) => Effect.sync(() => void secrets.delete(name)),
  });
}

function makeSettings(
  overrides: Partial<ServerSettings["integrations"]["composio"]>,
): ServerSettings {
  return {
    ...DEFAULT_SERVER_SETTINGS,
    integrations: {
      composio: {
        ...DEFAULT_SERVER_SETTINGS.integrations.composio,
        ...overrides,
      },
    },
  };
}

const makeProviderRegistryLayer = (providers: ReadonlyArray<unknown>) =>
  Layer.mock(ProviderRegistry)({
    getProviders: Effect.succeed(providers as never),
    refresh: () => Effect.succeed([]),
    refreshInstance: () => Effect.succeed([]),
    getProviderMaintenanceCapabilitiesForInstance: (_instanceId, provider) =>
      Effect.succeed(
        makeManualOnlyProviderMaintenanceCapabilities({ provider, packageName: null }),
      ),
    setProviderMaintenanceActionState: () => Effect.succeed([]),
    streamChanges: Stream.empty,
  });

const cloud = KairoCloudClient.of({
  exchangeInstallationGrant: () => Effect.die("unused"),
  getCapabilities: () =>
    Effect.succeed({ memory: true, composio: true, principal: "installation" }),
  issueComposioAccess: () =>
    Effect.succeed({ accessToken: "provider-grant-new", expiresAtEpochSeconds: 2_000_000_000 }),
  saveMemory: () => Effect.die("unused"),
  recallMemory: () => Effect.die("unused"),
  getMemoryContext: () => Effect.die("unused"),
});

describe("Composio cloud provider bindings", () => {
  it("injects only Kairo Cloud MCP access", () => {
    expect(
      buildComposioProviderEnvironment({
        accessToken: Redacted.make("provider-grant"),
        cloudApiUrl: "https://cloud.kairo.test",
      }),
    ).toEqual([
      {
        name: COMPOSIO_MCP_URL_ENV,
        value: "https://cloud.kairo.test/v1/composio/mcp",
        sensitive: false,
      },
      {
        name: COMPOSIO_AUTHORIZATION_ENV,
        value: "Bearer provider-grant",
        sensitive: true,
      },
    ]);
  });

  it.effect("augments only selected supported providers", () =>
    Effect.gen(function* () {
      const configMap: ProviderInstanceConfigMap = {
        [codexId]: { driver: codexDriver },
        [claudeId]: { driver: claudeDriver },
        [opencodeId]: { driver: opencodeDriver },
      };
      const result = yield* applyComposioProviderBindings(
        makeSettings({ enabled: true, providerInstanceIds: [codexId, opencodeId] }),
        configMap,
      ).pipe(
        Effect.provideService(
          ServerSecretStore.ServerSecretStore,
          makeSecretStore({ [COMPOSIO_ACCESS_TOKEN_SECRET]: "provider-grant" }),
        ),
      );

      expect(result[codexId]?.environment).toEqual([
        {
          name: COMPOSIO_MCP_URL_ENV,
          value: "https://kairo-cloud-api.vercel.app/v1/composio/mcp",
          sensitive: false,
        },
        {
          name: COMPOSIO_AUTHORIZATION_ENV,
          value: "Bearer provider-grant",
          sensitive: true,
        },
      ]);
      expect(result[claudeId]?.environment).toBeUndefined();
      expect(result[opencodeId]?.environment).toBeUndefined();
    }),
  );

  it("builds remote MCP configuration without putting grant in Codex arguments", () => {
    const environment = {
      [COMPOSIO_MCP_URL_ENV]: "https://cloud.kairo.test/v1/composio/mcp",
      [COMPOSIO_AUTHORIZATION_ENV]: "Bearer provider-secret",
    };
    const args = buildComposioCodexArgs(environment);
    expect(args.join(" ")).toContain("https://cloud.kairo.test/v1/composio/mcp");
    expect(args.join(" ")).toContain(COMPOSIO_AUTHORIZATION_ENV);
    expect(args.join(" ")).not.toContain("provider-secret");
    expect(buildComposioAcpMcpServers(environment)).toEqual([
      {
        type: "http",
        name: "composio",
        url: "https://cloud.kairo.test/v1/composio/mcp",
        headers: [{ name: "authorization", value: "Bearer provider-secret" }],
      },
    ]);
  });
});

describe("ComposioService", () => {
  it.effect("reports managed readiness per selected provider", () =>
    Effect.gen(function* () {
      const service = yield* makeComposioService.pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(
              makeSettings({ enabled: true, providerInstanceIds: [codexId, opencodeId] }),
            ),
            makeProviderRegistryLayer([
              { instanceId: codexId, driver: codexDriver, displayName: "Codex" },
              { instanceId: opencodeId, driver: opencodeDriver, displayName: "OpenCode" },
            ]),
            Layer.succeed(
              ServerSecretStore.ServerSecretStore,
              makeSecretStore({
                [KAIRO_CLOUD_ACCESS_TOKEN_SECRET]: "installation-grant",
                [COMPOSIO_ACCESS_TOKEN_SECRET]: "provider-grant",
              }),
            ),
            Layer.succeed(KairoCloudClient, cloud),
          ),
        ),
      );
      const status = yield* service.getStatus;
      expect(status.service).toMatchObject({ status: "available", available: true });
      expect(status.agentSupport).toEqual([
        expect.objectContaining({ providerInstanceId: codexId, status: "ready" }),
        expect.objectContaining({ providerInstanceId: opencodeId, status: "unsupported" }),
      ]);
    }),
  );

  it.effect("provisions a provider grant without accepting a user API key", () =>
    Effect.gen(function* () {
      const secretStore = makeSecretStore({
        [KAIRO_CLOUD_ACCESS_TOKEN_SECRET]: "installation-grant",
      });
      const settingsLayer = ServerSettingsService.layerTest(makeSettings({}));
      const service = yield* makeComposioService.pipe(
        Effect.provide(
          Layer.mergeAll(
            settingsLayer,
            makeProviderRegistryLayer([
              { instanceId: codexId, driver: codexDriver, displayName: "Codex" },
            ]),
            Layer.succeed(ServerSecretStore.ServerSecretStore, secretStore),
            Layer.succeed(KairoCloudClient, cloud),
          ),
        ),
      );
      const status = yield* service.configure({ providerInstanceIds: [codexId] });
      expect(status.service).toMatchObject({ status: "available", available: true });
      expect(status).not.toHaveProperty("apiKey");
      const stored = yield* secretStore.get(COMPOSIO_ACCESS_TOKEN_SECRET);
      expect(Option.map(stored, (value) => new TextDecoder().decode(value))).toEqual(
        Option.some("provider-grant-new"),
      );
    }),
  );
});
