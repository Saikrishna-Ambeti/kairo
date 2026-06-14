import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  type ConfigureMemoryInput,
  type InstallMemoryProvidersInput,
  ProviderDriverKind,
  type ProviderInstanceId,
  ServerSettingsError,
  SupermemoryError,
  type SupermemoryStatus,
  type TestMemoryConnectionInput,
} from "@kairo/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { deriveProviderInstanceConfigMap } from "../provider/Layers/ProviderInstanceRegistryHydration.ts";
import {
  redactSupermemorySecrets,
  getSupermemoryApiKey,
  setSupermemoryApiKey,
} from "./SupermemorySecrets.ts";
import {
  computeProviderMemoryStatus,
  installSupermemoryProviders,
} from "./SupermemoryProviderInstaller.ts";
import { ProcessRunner, layer as ProcessRunnerLive } from "../processRunner.ts";
import {
  getCodexSupermemoryIntegrationState,
  removeSyncedCodexSupermemoryCredentials,
  syncCodexSupermemoryIntegration,
} from "./SupermemoryCodexIntegration.ts";

type SupermemoryServiceError = SupermemoryError | ServerSettingsError;

const CODEX_DRIVER = "codex" as ProviderDriverKind;

interface AuthProbeState {
  readonly lastTestedAt: string | undefined;
  readonly lastError: string | undefined;
}

export interface SupermemoryServiceShape {
  readonly getStatus: Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly configure: (
    input: ConfigureMemoryInput,
  ) => Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly testConnection: (
    input?: TestMemoryConnectionInput,
  ) => Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly installProviders: (
    input: InstallMemoryProvidersInput,
  ) => Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly disable: Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
}

export class SupermemoryService extends Context.Service<
  SupermemoryService,
  SupermemoryServiceShape
>()("kairo/memory/SupermemoryService") {}

const probeSupermemory = (input: {
  readonly apiUrl: string;
  readonly apiKey: string;
}): Effect.Effect<void, SupermemoryError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const url = new URL("/v3/documents", input.apiUrl);
    url.searchParams.set("limit", "1");
    const httpClient = yield* HttpClient.HttpClient;
    const response = yield* httpClient
      .execute(
        HttpClientRequest.get(url.toString()).pipe(
          HttpClientRequest.bearerToken(input.apiKey),
          HttpClientRequest.acceptJson,
        ),
      )
      .pipe(
        Effect.timeout("5 seconds"),
        Effect.mapError(
          (cause) =>
            new SupermemoryError({
              message: "Failed to reach Supermemory.",
              cause,
            }),
        ),
      );
    if (response.status === 401 || response.status === 403) {
      return yield* new SupermemoryError({
        message: "Supermemory rejected the API key.",
      });
    }
    if (response.status >= 500) {
      return yield* new SupermemoryError({
        message: `Supermemory returned HTTP ${response.status}.`,
      });
    }
  });

function displayNameForDriver(driver: ProviderDriverKind): string {
  switch (driver) {
    case "codex":
      return "Codex";
    case "claudeAgent":
      return "Claude";
    case "opencode":
      return "OpenCode";
    case "cursor":
      return "Cursor";
    case "grok":
      return "Grok";
    default:
      return driver;
  }
}

export const makeSupermemoryService = Effect.gen(function* () {
  const serverSettings = yield* ServerSettingsService;
  const providerRegistry = yield* ProviderRegistry;
  const secretStore = yield* ServerSecretStore.ServerSecretStore;
  const httpClient = yield* HttpClient.HttpClient;
  const processRunner = yield* ProcessRunner;
  const fileSystem = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const authStateRef = yield* Ref.make<AuthProbeState>({
    lastTestedAt: undefined,
    lastError: undefined,
  });

  const withSecrets = <A, E, R>(
    effect: Effect.Effect<A, E, R | ServerSecretStore.ServerSecretStore>,
  ) => effect.pipe(Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore));
  const withHttp = <A, E, R>(effect: Effect.Effect<A, E, R | HttpClient.HttpClient>) =>
    effect.pipe(Effect.provideService(HttpClient.HttpClient, httpClient));
  const withProcessRunner = <A, E, R>(effect: Effect.Effect<A, E, R | ProcessRunner>) =>
    effect.pipe(Effect.provideService(ProcessRunner, processRunner));
  const withFileServices = <A, E, R>(
    effect: Effect.Effect<A, E, R | FileSystem.FileSystem | Path.Path>,
  ) =>
    effect.pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, pathService),
    );
  const nowIso = DateTime.now.pipe(Effect.map(DateTime.formatIso));

  const syncSelectedCodexIntegrations = (input: {
    readonly providerInstanceIds: ReadonlyArray<ProviderInstanceId>;
    readonly apiKey: string;
  }) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      const configMap = deriveProviderInstanceConfigMap(settings);
      yield* Effect.forEach(
        input.providerInstanceIds,
        (instanceId) => {
          const entry = configMap[instanceId];
          if (entry?.driver !== CODEX_DRIVER) return Effect.void;
          return withFileServices(
            syncCodexSupermemoryIntegration({
              config: entry.config,
              apiKey: input.apiKey,
            }),
          );
        },
        { discard: true },
      );
    });

  const removeSelectedCodexCredentials = (input: {
    readonly providerInstanceIds: ReadonlyArray<ProviderInstanceId>;
    readonly apiKey: string | undefined;
  }) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      const configMap = deriveProviderInstanceConfigMap(settings);
      yield* Effect.forEach(
        input.providerInstanceIds,
        (instanceId) => {
          const entry = configMap[instanceId];
          if (entry?.driver !== CODEX_DRIVER) return Effect.void;
          return withFileServices(
            removeSyncedCodexSupermemoryCredentials({
              config: entry.config,
              apiKey: input.apiKey,
            }),
          );
        },
        { discard: true },
      );
    });

  const buildStatus = Effect.gen(function* () {
    const settings = yield* serverSettings.getSettings;
    const memory = settings.memory.supermemory;
    const configMap = deriveProviderInstanceConfigMap(settings);
    const apiKey = yield* withSecrets(getSupermemoryApiKey()).pipe(
      Effect.orElseSucceed(() => null),
    );
    if (memory.enabled && apiKey) {
      yield* syncSelectedCodexIntegrations({
        providerInstanceIds: memory.providerInstanceIds,
        apiKey,
      });
    }
    const authState = yield* Ref.get(authStateRef);
    const selectedIds = new Set<ProviderInstanceId>(memory.providerInstanceIds);
    const providers = yield* providerRegistry.getProviders;
    const providerStatuses = yield* Effect.forEach(
      providers,
      (provider) =>
        Effect.gen(function* () {
          const codexIntegration =
            provider.driver === CODEX_DRIVER
              ? yield* withFileServices(
                  getCodexSupermemoryIntegrationState({
                    config: configMap[provider.instanceId]?.config,
                    apiKey: apiKey ?? undefined,
                  }),
                )
              : undefined;
          return computeProviderMemoryStatus({
            instanceId: provider.instanceId,
            driver: provider.driver,
            displayName:
              provider.displayName ??
              displayNameForDriver(provider.driver) ??
              String(provider.instanceId),
            selected: selectedIds.has(provider.instanceId),
            hasApiKey: Boolean(apiKey),
            ...(codexIntegration ? { codexIntegration } : {}),
          });
        }),
      { concurrency: "unbounded" },
    );

    return {
      enabled: memory.enabled,
      mode: "hosted",
      scope: memory.scope,
      auth: {
        hasApiKey: Boolean(apiKey),
        ...(authState.lastTestedAt ? { lastTestedAt: authState.lastTestedAt } : {}),
        ...(authState.lastError ? { lastError: authState.lastError } : {}),
      },
      providers: providerStatuses,
    } satisfies SupermemoryStatus;
  });

  const testConnection: SupermemoryServiceShape["testConnection"] = (input) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      const apiKey = input?.apiKey?.trim() || (yield* withSecrets(getSupermemoryApiKey()));
      const testedAt = yield* nowIso;
      if (!apiKey) {
        yield* Ref.set(authStateRef, {
          lastTestedAt: testedAt,
          lastError: "Missing Supermemory API key.",
        });
        return yield* buildStatus;
      }

      const apiUrl = settings.memory.supermemory.hosted.apiUrl;
      const result = yield* withHttp(probeSupermemory({ apiUrl, apiKey })).pipe(Effect.result);
      yield* Ref.set(authStateRef, {
        lastTestedAt: testedAt,
        lastError:
          result._tag === "Failure" ? redactSupermemorySecrets(String(result.failure)) : undefined,
      });
      return yield* buildStatus;
    });

  const configure: SupermemoryServiceShape["configure"] = (input) =>
    Effect.gen(function* () {
      const apiKey = input.apiKey?.trim();
      if (apiKey) {
        yield* withSecrets(setSupermemoryApiKey(apiKey));
      }
      yield* serverSettings.updateSettings({
        memory: {
          supermemory: {
            enabled: true,
            mode: "hosted",
            scope: "user",
            providerInstanceIds: input.providerInstanceIds,
          },
        },
      });
      const effectiveApiKey = apiKey || (yield* withSecrets(getSupermemoryApiKey()));
      if (effectiveApiKey) {
        yield* syncSelectedCodexIntegrations({
          providerInstanceIds: input.providerInstanceIds,
          apiKey: effectiveApiKey,
        });
      }
      return yield* buildStatus;
    });

  const installProviders: SupermemoryServiceShape["installProviders"] = (input) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      yield* withProcessRunner(
        installSupermemoryProviders({
          providerInstanceIds: input.providerInstanceIds,
          configMap: deriveProviderInstanceConfigMap(settings),
        }),
      );
      const apiKey = yield* withSecrets(getSupermemoryApiKey()).pipe(
        Effect.orElseSucceed(() => null),
      );
      if (apiKey) {
        yield* syncSelectedCodexIntegrations({
          providerInstanceIds: input.providerInstanceIds,
          apiKey,
        });
      }
      return yield* buildStatus;
    });

  const disable = Effect.gen(function* () {
    const settings = yield* serverSettings.getSettings;
    const apiKey =
      (yield* withSecrets(getSupermemoryApiKey()).pipe(Effect.orElseSucceed(() => undefined))) ??
      undefined;
    yield* removeSelectedCodexCredentials({
      providerInstanceIds: settings.memory.supermemory.providerInstanceIds,
      apiKey,
    });
    yield* serverSettings.updateSettings({
      memory: {
        supermemory: {
          enabled: false,
          mode: "hosted",
          providerInstanceIds: [],
        },
      },
    });
    return yield* buildStatus;
  });

  return {
    getStatus: buildStatus,
    configure,
    testConnection,
    installProviders,
    disable,
  } satisfies SupermemoryServiceShape;
});

export const SupermemoryServiceLive = Layer.effect(SupermemoryService, makeSupermemoryService).pipe(
  Layer.provide(ServerSecretStore.layer),
  Layer.provide(ProcessRunnerLive),
  Layer.provide(NodeServices.layer),
);
