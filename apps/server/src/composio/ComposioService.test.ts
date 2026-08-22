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
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../provider/providerMaintenance.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { buildComposioAcpMcpServers, buildComposioCodexArgs } from "./ComposioMcp.ts";
import {
  applyComposioProviderBindings,
  buildComposioProviderEnvironment,
  COMPOSIO_API_KEY_ENV,
  COMPOSIO_MCP_URL,
} from "./ComposioProviderBindings.ts";
import { makeComposioService } from "./ComposioService.ts";

const codexId = ProviderInstanceId.make("codex");
const claudeId = ProviderInstanceId.make("claudeAgent");
const opencodeId = ProviderInstanceId.make("opencode");
const codexDriver = ProviderDriverKind.make("codex");
const claudeDriver = ProviderDriverKind.make("claudeAgent");
const opencodeDriver = ProviderDriverKind.make("opencode");

function makeSecretStore(initial: string | null): ServerSecretStore.ServerSecretStore["Service"] {
  let secret = initial ? Option.some(new TextEncoder().encode(initial)) : Option.none<Uint8Array>();
  return {
    get: () => Effect.succeed(secret),
    set: (_name, value) => Effect.sync(() => void (secret = Option.some(value))),
    create: () => Effect.void,
    getOrCreateRandom: () =>
      Effect.succeed(
        Option.getOrElse(secret, () => new TextEncoder().encode("generated-composio-key")),
      ),
    remove: () => Effect.sync(() => void (secret = Option.none())),
  };
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

describe("Composio cloud provider bindings", () => {
  it("injects only the API key needed by remote MCP clients", () => {
    expect(buildComposioProviderEnvironment({ apiKey: "consumer-key" })).toEqual([
      { name: COMPOSIO_API_KEY_ENV, value: "consumer-key", sensitive: true },
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
        Effect.provideService(ServerSecretStore.ServerSecretStore, makeSecretStore("consumer-key")),
      );

      expect(result[codexId]?.environment).toEqual([
        { name: COMPOSIO_API_KEY_ENV, value: "consumer-key", sensitive: true },
      ]);
      expect(result[claudeId]?.environment).toBeUndefined();
      expect(result[opencodeId]?.environment).toBeUndefined();
    }),
  );

  it("builds remote MCP configuration without putting the key in Codex arguments", () => {
    const environment = { [COMPOSIO_API_KEY_ENV]: "consumer-secret" };
    const args = buildComposioCodexArgs(environment);
    expect(args.join(" ")).toContain(COMPOSIO_MCP_URL);
    expect(args.join(" ")).toContain(COMPOSIO_API_KEY_ENV);
    expect(args.join(" ")).not.toContain("consumer-secret");
    expect(buildComposioAcpMcpServers(environment)).toEqual([
      {
        type: "http",
        name: "composio",
        url: COMPOSIO_MCP_URL,
        headers: [{ name: "x-consumer-api-key", value: "consumer-secret" }],
      },
    ]);
  });
});

describe("ComposioService", () => {
  it.effect("reports cloud readiness per selected provider", () =>
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
            Layer.succeed(ServerSecretStore.ServerSecretStore, makeSecretStore("consumer-key")),
            Layer.succeed(
              HttpClient.HttpClient,
              HttpClient.make((request) =>
                Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null))),
              ),
            ),
          ),
        ),
      );
      const status = yield* service.getStatus;
      expect(status.auth).toMatchObject({ status: "configured", hasApiKey: true });
      expect(status.agentSupport).toEqual([
        expect.objectContaining({ providerInstanceId: codexId, status: "ready" }),
        expect.objectContaining({ providerInstanceId: opencodeId, status: "unsupported" }),
      ]);
    }),
  );

  it.effect("records rejected cloud credentials without exposing the key", () =>
    Effect.gen(function* () {
      const service = yield* makeComposioService.pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(makeSettings({})),
            makeProviderRegistryLayer([]),
            Layer.succeed(ServerSecretStore.ServerSecretStore, makeSecretStore(null)),
            Layer.succeed(
              HttpClient.HttpClient,
              HttpClient.make((request) =>
                Effect.succeed(
                  HttpClientResponse.fromWeb(request, new Response(null, { status: 401 })),
                ),
              ),
            ),
          ),
        ),
      );
      const status = yield* service.testConnection({ apiKey: "consumer-secret" });
      expect(status.auth).toMatchObject({
        status: "error",
        hasApiKey: false,
        lastError: "Composio rejected the API key.",
      });
      expect(status.auth).not.toHaveProperty("apiKey");
    }),
  );
});
