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

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { KairoCloudClient } from "../cloud/KairoCloudClient.ts";
import * as KairoCloudClientLive from "../cloud/KairoCloudClient.ts";
import { getKairoCloudAccessToken } from "../memory/SupermemorySecrets.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import {
  getComposioAccessToken,
  removeComposioAccessToken,
  setComposioAccessToken,
} from "./ComposioSecrets.ts";
import { isComposioDriverSupported } from "./ComposioProviderBindings.ts";

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

export const makeComposioService = Effect.gen(function* () {
  const serverSettings = yield* ServerSettingsService;
  const providerRegistry = yield* ProviderRegistry;
  const secretStore = yield* ServerSecretStore.ServerSecretStore;
  const cloud = yield* KairoCloudClient;
  const connectionStateRef = yield* Ref.make<ConnectionState>({
    lastTestedAt: undefined,
    lastError: undefined,
  });

  const withSecrets = <A, E, R>(
    effect: Effect.Effect<A, E, R | ServerSecretStore.ServerSecretStore>,
  ) => effect.pipe(Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore));

  const readInstallationGrant = getKairoCloudAccessToken().pipe(
    Effect.provideService(ServerSecretStore.ServerSecretStore, secretStore),
    Effect.mapError(
      (cause) => new ComposioError({ message: "Failed to read Kairo Cloud access.", cause }),
    ),
  );

  const provisionProviderAccess = Effect.fn("ComposioService.provisionProviderAccess")(
    function* () {
      const installationGrant = yield* readInstallationGrant;
      if (!installationGrant) {
        return yield* new ComposioError({
          message: "Sign in to Kairo before enabling app integrations.",
        });
      }
      const capabilities = yield* cloud
        .getCapabilities(installationGrant)
        .pipe(
          Effect.mapError(
            (cause) => new ComposioError({ message: "Kairo Cloud is unavailable.", cause }),
          ),
        );
      if (!capabilities.composio) {
        return yield* new ComposioError({ message: "Composio is unavailable in Kairo Cloud." });
      }
      const access = yield* cloud.issueComposioAccess(installationGrant);
      yield* withSecrets(setComposioAccessToken(access.accessToken));
    },
  );

  const buildStatus = Effect.gen(function* () {
    const settings = yield* serverSettings.getSettings;
    const composio = settings.integrations.composio;
    const installationGrant = yield* readInstallationGrant.pipe(Effect.orElseSucceed(() => null));
    const providerGrant = yield* withSecrets(getComposioAccessToken()).pipe(
      Effect.orElseSucceed(() => null),
    );
    const capabilities = installationGrant
      ? yield* cloud.getCapabilities(installationGrant).pipe(
          Effect.map((value) => value.composio),
          Effect.orElseSucceed(() => false),
        )
      : false;
    const available = capabilities;
    const providerReady = available && providerGrant !== null;
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
            : !providerReady
              ? ("needs_action" as const)
              : ("ready" as const),
        message: !supported
          ? "This provider does not support remote Composio tools yet."
          : !selected
            ? "Enable Composio for this provider."
            : !providerReady
              ? "Kairo Cloud app integrations are unavailable."
              : "Composio tools will be available in new sessions.",
      };
    });

    return {
      enabled: composio.enabled,
      service: {
        status: connectionState.lastError
          ? ("error" as const)
          : available
            ? ("available" as const)
            : ("unavailable" as const),
        available,
        ...(connectionState.lastTestedAt ? { lastTestedAt: connectionState.lastTestedAt } : {}),
        ...(connectionState.lastError ? { lastError: connectionState.lastError } : {}),
      },
      agentSupport,
    } satisfies ComposioStatus;
  });

  const configure: ComposioServiceShape["configure"] = (input) =>
    Effect.gen(function* () {
      yield* provisionProviderAccess();
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

  const testConnection: ComposioServiceShape["testConnection"] = () =>
    Effect.gen(function* () {
      const lastTestedAt = DateTime.formatIso(yield* DateTime.now);
      const result = yield* provisionProviderAccess().pipe(Effect.result);
      yield* Ref.set(connectionStateRef, {
        lastTestedAt,
        lastError: result._tag === "Failure" ? result.failure.message : undefined,
      });
      return yield* buildStatus;
    });

  const disable = Effect.gen(function* () {
    yield* withSecrets(removeComposioAccessToken());
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
  Layer.provideMerge(ServerSecretStore.layer),
  Layer.provideMerge(KairoCloudClientLive.layer),
);
