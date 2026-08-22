import {
  type ConfigureMemoryInput,
  type ProviderDriverKind,
  type ProviderInstanceId,
  ServerSettingsError,
  SupermemoryError,
  type SupermemoryStatus,
} from "@kairo/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { KairoCloudClient } from "../cloud/KairoCloudClient.ts";
import * as KairoCloudClientLive from "../cloud/KairoCloudClient.ts";
import { ServerEnvironment } from "../environment/ServerEnvironment.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { computeProviderMemoryStatus } from "./SupermemoryMcp.ts";
import { getKairoCloudAccessToken, KAIRO_CLOUD_ACCESS_TOKEN_SECRET } from "./SupermemorySecrets.ts";

type SupermemoryServiceError = SupermemoryError | ServerSettingsError;

export interface SupermemoryRecallInput {
  readonly query: string;
  readonly limit?: number | undefined;
}

export interface SupermemoryContextInput {
  readonly query?: string | undefined;
}

export interface SupermemoryServiceShape {
  readonly provisionAccess: (clerkToken: string) => Effect.Effect<void, SupermemoryError>;
  readonly getStatus: Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly configure: (
    input: ConfigureMemoryInput,
  ) => Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly disable: Effect.Effect<SupermemoryStatus, SupermemoryServiceError>;
  readonly save: (
    providerInstanceId: ProviderInstanceId,
    content: string,
  ) => Effect.Effect<unknown, SupermemoryError>;
  readonly recall: (
    providerInstanceId: ProviderInstanceId,
    input: SupermemoryRecallInput,
  ) => Effect.Effect<unknown, SupermemoryError>;
  readonly context: (
    providerInstanceId: ProviderInstanceId,
    input: SupermemoryContextInput,
  ) => Effect.Effect<unknown, SupermemoryError>;
}

export class SupermemoryService extends Context.Service<
  SupermemoryService,
  SupermemoryServiceShape
>()("kairo/memory/SupermemoryService") {}

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
  const cloud = yield* KairoCloudClient;
  const environment = yield* ServerEnvironment;

  const readAccessToken = getKairoCloudAccessToken().pipe(
    Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore),
  );

  const provisionAccess: SupermemoryServiceShape["provisionAccess"] = Effect.fn(
    "SupermemoryService.provisionAccess",
  )(function* (clerkToken) {
    const environmentId = yield* environment.getEnvironmentId;
    const grant = yield* cloud.exchangeInstallationGrant(Redacted.make(clerkToken), {
      environmentId,
    });
    yield* secretStore
      .set(KAIRO_CLOUD_ACCESS_TOKEN_SECRET, new TextEncoder().encode(grant.accessToken))
      .pipe(
        Effect.mapError(
          (cause) =>
            new SupermemoryError({
              message: "Failed to store Kairo Cloud access.",
              cause,
            }),
        ),
      );
  });

  const request = <A>(input: {
    readonly providerInstanceId: ProviderInstanceId;
    readonly execute: (
      accessToken: Redacted.Redacted<string>,
    ) => Effect.Effect<A, SupermemoryError>;
  }) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings.pipe(
        Effect.mapError(
          (cause) =>
            new SupermemoryError({
              message: "Failed to read hosted Supermemory settings.",
              cause,
            }),
        ),
      );
      const memorySettings = settings.memory.supermemory;
      if (
        !memorySettings.enabled ||
        !memorySettings.providerInstanceIds.includes(input.providerInstanceId)
      ) {
        return yield* new SupermemoryError({
          message: "Hosted memory is not enabled for this provider.",
        });
      }
      const accessToken = yield* readAccessToken;
      if (!accessToken) {
        return yield* new SupermemoryError({
          message: "Kairo Cloud memory is unavailable on this server.",
        });
      }
      return yield* input.execute(accessToken);
    });

  const save: SupermemoryServiceShape["save"] = (providerInstanceId, content) =>
    request({
      providerInstanceId,
      execute: (accessToken) => cloud.saveMemory(accessToken, { content }),
    });

  const recall: SupermemoryServiceShape["recall"] = (providerInstanceId, input) =>
    request({
      providerInstanceId,
      execute: (accessToken) =>
        cloud.recallMemory(accessToken, {
          query: input.query,
          ...(input.limit === undefined ? {} : { limit: input.limit }),
        }),
    });

  const context: SupermemoryServiceShape["context"] = (providerInstanceId, input) =>
    request({
      providerInstanceId,
      execute: (accessToken) =>
        cloud.getMemoryContext(accessToken, input.query ? { query: input.query } : {}),
    });

  const buildStatus = Effect.gen(function* () {
    const settings = yield* serverSettings.getSettings;
    const memory = settings.memory.supermemory;
    const accessToken = yield* readAccessToken.pipe(Effect.orElseSucceed(() => null));
    const serviceAvailable = accessToken
      ? yield* cloud.getCapabilities(accessToken).pipe(
          Effect.as(true),
          Effect.orElseSucceed(() => false),
        )
      : false;
    const selectedIds = new Set<ProviderInstanceId>(memory.providerInstanceIds);
    const providers = yield* providerRegistry.getProviders;
    const providerStatuses = providers.map((provider) =>
      computeProviderMemoryStatus({
        instanceId: provider.instanceId,
        driver: provider.driver,
        displayName: provider.displayName ?? displayNameForDriver(provider.driver),
        selected: selectedIds.has(provider.instanceId),
        serviceConfigured: serviceAvailable,
      }),
    );

    return {
      enabled: memory.enabled,
      mode: "hosted",
      scope: memory.scope,
      service: {
        available: serviceAvailable,
      },
      providers: providerStatuses,
    } satisfies SupermemoryStatus;
  });

  const configure: SupermemoryServiceShape["configure"] = (input) =>
    Effect.gen(function* () {
      const accessToken = yield* readAccessToken;
      if (!accessToken) {
        return yield* new SupermemoryError({
          message: "Kairo Cloud access is required before enabling hosted memory.",
        });
      }
      yield* cloud.getCapabilities(accessToken);
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
      return yield* buildStatus;
    });

  const disable = Effect.gen(function* () {
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
    provisionAccess,
    getStatus: buildStatus,
    configure,
    disable,
    save,
    recall,
    context,
  } satisfies SupermemoryServiceShape;
});

export const SupermemoryServiceLive = Layer.effect(SupermemoryService, makeSupermemoryService).pipe(
  Layer.provideMerge(ServerSecretStore.layer),
  Layer.provideMerge(KairoCloudClientLive.layer),
);
