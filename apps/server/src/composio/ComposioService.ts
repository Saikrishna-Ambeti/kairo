import {
  ComposioError,
  type ComposioStatus,
  type ConfigureComposioInput,
  type ProviderDriverKind,
  type ProviderInstanceId,
  type TestComposioConnectionInput,
  ServerSettingsError,
} from "@kairo/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { COMPOSIO_MCP_URL, isComposioDriverSupported } from "./ComposioProviderBindings.ts";
import { getComposioApiKey, removeComposioApiKey, setComposioApiKey } from "./ComposioSecrets.ts";

type ComposioServiceError = ComposioError | ServerSettingsError;

interface ConnectionState {
  readonly lastTestedAt: string | undefined;
  readonly lastError: string | undefined;
}

export interface ComposioServiceShape {
  readonly getStatus: Effect.Effect<ComposioStatus, ComposioServiceError>;
  readonly configure: (
    input: ConfigureComposioInput,
  ) => Effect.Effect<ComposioStatus, ComposioServiceError>;
  readonly testConnection: (
    input?: TestComposioConnectionInput,
  ) => Effect.Effect<ComposioStatus, ComposioServiceError>;
  readonly disable: Effect.Effect<ComposioStatus, ComposioServiceError>;
}

export class ComposioService extends Context.Service<ComposioService, ComposioServiceShape>()(
  "kairo/composio/ComposioService",
) {}

function displayNameForDriver(driver: ProviderDriverKind): string {
  switch (driver) {
    case "codex":
      return "Codex";
    case "claudeAgent":
      return "Claude";
    case "cursor":
      return "Cursor";
    case "grok":
      return "Grok";
    case "opencode":
      return "OpenCode";
    default:
      return driver;
  }
}

const probeComposio = Effect.fn("ComposioService.probe")(function* (apiKey: string) {
  const httpClient = yield* HttpClient.HttpClient;
  const response = yield* HttpClientRequest.post(COMPOSIO_MCP_URL).pipe(
    HttpClientRequest.setHeaders({
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "x-consumer-api-key": apiKey,
    }),
    HttpClientRequest.bodyJson({
      jsonrpc: "2.0",
      id: "kairo-composio-probe",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "kairo", version: "1" },
      },
    }),
    Effect.flatMap(httpClient.execute),
    Effect.timeout("10 seconds"),
    Effect.mapError(
      (cause) => new ComposioError({ message: "Failed to reach Composio Connect.", cause }),
    ),
  );
  if (response.status === 401 || response.status === 403) {
    return yield* new ComposioError({ message: "Composio rejected the API key." });
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new ComposioError({
      message: `Composio Connect returned HTTP ${response.status}.`,
    });
  }
});

export const makeComposioService = Effect.gen(function* () {
  const serverSettings = yield* ServerSettingsService;
  const providerRegistry = yield* ProviderRegistry;
  const secretStore = yield* ServerSecretStore.ServerSecretStore;
  const httpClient = yield* HttpClient.HttpClient;
  const connectionStateRef = yield* Ref.make<ConnectionState>({
    lastTestedAt: undefined,
    lastError: undefined,
  });

  const withSecrets = <A, E, R>(
    effect: Effect.Effect<A, E, R | ServerSecretStore.ServerSecretStore>,
  ) => effect.pipe(Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore));
  const withHttp = <A, E, R>(effect: Effect.Effect<A, E, R | HttpClient.HttpClient>) =>
    effect.pipe(Effect.provideService(HttpClient.HttpClient, httpClient));

  const buildStatus = Effect.gen(function* () {
    const settings = yield* serverSettings.getSettings;
    const composio = settings.integrations.composio;
    const apiKey = yield* withSecrets(getComposioApiKey()).pipe(Effect.orElseSucceed(() => null));
    const connectionState = yield* Ref.get(connectionStateRef);
    const selectedIds = new Set<ProviderInstanceId>(composio.providerInstanceIds);
    const providers = yield* providerRegistry.getProviders;
    const agentSupport = providers.map((provider) => {
      const selected = selectedIds.has(provider.instanceId);
      const supported = isComposioDriverSupported(provider.driver);
      return {
        providerInstanceId: provider.instanceId,
        driver: provider.driver,
        displayName: provider.displayName ?? displayNameForDriver(provider.driver),
        selected,
        supported,
        status: !supported
          ? ("unsupported" as const)
          : !selected
            ? ("not_selected" as const)
            : !apiKey
              ? ("needs_key" as const)
              : ("ready" as const),
        message: !supported
          ? "This provider does not support a remote Composio MCP server yet."
          : !selected
            ? "Enable Composio for this provider."
            : !apiKey
              ? "Add a Composio Connect API key."
              : "Composio Connect will be available in new sessions.",
      };
    });

    return {
      enabled: composio.enabled,
      endpoint: COMPOSIO_MCP_URL,
      auth: {
        status: connectionState.lastError
          ? ("error" as const)
          : apiKey
            ? ("configured" as const)
            : ("not_configured" as const),
        hasApiKey: Boolean(apiKey),
        ...(connectionState.lastTestedAt ? { lastTestedAt: connectionState.lastTestedAt } : {}),
        ...(connectionState.lastError ? { lastError: connectionState.lastError } : {}),
      },
      agentSupport,
    } satisfies ComposioStatus;
  });

  const configure: ComposioServiceShape["configure"] = (input) =>
    Effect.gen(function* () {
      const apiKey = input.apiKey?.trim();
      if (apiKey) yield* withSecrets(setComposioApiKey(apiKey));
      yield* serverSettings.updateSettings({
        integrations: {
          composio: {
            enabled: true,
            providerInstanceIds: input.providerInstanceIds,
          },
        },
      });
      yield* Ref.set(connectionStateRef, { lastTestedAt: undefined, lastError: undefined });
      return yield* buildStatus;
    });

  const testConnection: ComposioServiceShape["testConnection"] = (input) =>
    Effect.gen(function* () {
      const apiKey = input?.apiKey?.trim() || (yield* withSecrets(getComposioApiKey()));
      const lastTestedAt = DateTime.formatIso(yield* DateTime.now);
      if (!apiKey) {
        yield* Ref.set(connectionStateRef, {
          lastTestedAt,
          lastError: "Missing Composio Connect API key.",
        });
        return yield* buildStatus;
      }
      const result = yield* withHttp(probeComposio(apiKey)).pipe(Effect.result);
      yield* Ref.set(connectionStateRef, {
        lastTestedAt,
        lastError: result._tag === "Failure" ? result.failure.message : undefined,
      });
      return yield* buildStatus;
    });

  const disable = Effect.gen(function* () {
    yield* withSecrets(removeComposioApiKey());
    yield* serverSettings.updateSettings({
      integrations: { composio: { enabled: false, providerInstanceIds: [] } },
    });
    yield* Ref.set(connectionStateRef, { lastTestedAt: undefined, lastError: undefined });
    return yield* buildStatus;
  });

  return {
    getStatus: buildStatus,
    configure,
    testConnection,
    disable,
  } satisfies ComposioServiceShape;
});

export const ComposioServiceLive = Layer.effect(ComposioService, makeComposioService).pipe(
  Layer.provide(ServerSecretStore.layer),
);
