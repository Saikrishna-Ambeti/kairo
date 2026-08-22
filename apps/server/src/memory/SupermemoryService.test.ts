import { describe, expect, it } from "@effect/vitest";
import { ProviderInstanceId, SupermemoryError } from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { KairoCloudClient } from "../cloud/KairoCloudClient.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../provider/providerMaintenance.ts";
import { ProviderRegistry } from "../provider/Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { KAIRO_CLOUD_ACCESS_TOKEN_SECRET } from "./SupermemorySecrets.ts";
import { makeSupermemoryService, SupermemoryService } from "./SupermemoryService.ts";

const encoder = new TextEncoder();
const codexInstanceId = ProviderInstanceId.make("codex");

const secretStore = ServerSecretStore.ServerSecretStore.of({
  get: (name) =>
    Effect.succeed(
      name === KAIRO_CLOUD_ACCESS_TOKEN_SECRET
        ? Option.some(encoder.encode("installation_grant"))
        : Option.none(),
    ),
  set: () => Effect.die("unused"),
  create: () => Effect.die("unused"),
  getOrCreateRandom: () => Effect.die("unused"),
  remove: () => Effect.die("unused"),
});

const providerRegistry = Layer.mock(ProviderRegistry)({
  getProviders: Effect.succeed([]),
  refresh: () => Effect.succeed([]),
  refreshInstance: () => Effect.succeed([]),
  getProviderMaintenanceCapabilitiesForInstance: (_instanceId, provider) =>
    Effect.succeed(makeManualOnlyProviderMaintenanceCapabilities({ provider, packageName: null })),
  setProviderMaintenanceActionState: () => Effect.succeed([]),
  streamChanges: Stream.empty,
});

function makeDependencies(cloud: KairoCloudClient["Service"]) {
  return Layer.mergeAll(
    ServerSettingsService.layerTest({
      memory: {
        supermemory: {
          enabled: true,
          providerInstanceIds: [codexInstanceId],
        },
      },
    }),
    providerRegistry,
    Layer.succeed(ServerSecretStore.ServerSecretStore, secretStore),
    Layer.succeed(KairoCloudClient, cloud),
  );
}

describe("SupermemoryService", () => {
  it.effect("sends semantic memory operations to Kairo Cloud", () =>
    Effect.gen(function* () {
      const calls: Array<{ readonly operation: string; readonly input: unknown }> = [];
      const cloud = KairoCloudClient.of({
        getCapabilities: () => Effect.succeed({ memory: true, principal: "installation" }),
        saveMemory: (_token, input) =>
          Effect.sync(() => {
            calls.push({ operation: "save", input });
            return { id: "memory_1", status: "queued" };
          }),
        recallMemory: (_token, input) =>
          Effect.sync(() => {
            calls.push({ operation: "recall", input });
            return { results: [], timing: 1, total: 0 };
          }),
        getMemoryContext: (_token, input) =>
          Effect.sync(() => {
            calls.push({ operation: "context", input });
            return { profile: { static: [], dynamic: [] } };
          }),
      });
      const serviceLayer = Layer.effect(SupermemoryService, makeSupermemoryService).pipe(
        Layer.provideMerge(makeDependencies(cloud)),
      );

      yield* Effect.gen(function* () {
        const memory = yield* SupermemoryService;
        const settings = yield* ServerSettingsService;
        yield* memory.save(codexInstanceId, "Prefers compact answers");
        yield* memory.recall(codexInstanceId, { query: "answer style", limit: 3 });
        yield* memory.context(codexInstanceId, { query: "communication" });
        yield* settings.updateSettings({
          memory: { supermemory: { enabled: false, providerInstanceIds: [] } },
        });
        const disabledResult = yield* Effect.result(
          memory.save(codexInstanceId, "must not be saved"),
        );
        expect(disabledResult._tag).toBe("Failure");
      }).pipe(Effect.provide(serviceLayer));

      expect(calls).toEqual([
        { operation: "save", input: { content: "Prefers compact answers" } },
        { operation: "recall", input: { query: "answer style", limit: 3 } },
        { operation: "context", input: { query: "communication" } },
      ]);
    }),
  );

  it.effect("does not enable memory when the Kairo Cloud grant fails validation", () =>
    Effect.gen(function* () {
      const cloud = KairoCloudClient.of({
        getCapabilities: () => Effect.fail(new SupermemoryError({ message: "grant expired" })),
        saveMemory: () => Effect.die("unused"),
        recallMemory: () => Effect.die("unused"),
        getMemoryContext: () => Effect.die("unused"),
      });
      const dependencies = Layer.mergeAll(
        ServerSettingsService.layerTest(),
        providerRegistry,
        Layer.succeed(ServerSecretStore.ServerSecretStore, secretStore),
        Layer.succeed(KairoCloudClient, cloud),
      );
      const serviceLayer = Layer.effect(SupermemoryService, makeSupermemoryService).pipe(
        Layer.provideMerge(dependencies),
      );

      yield* Effect.gen(function* () {
        const memory = yield* SupermemoryService;
        const settings = yield* ServerSettingsService;
        const result = yield* Effect.result(
          memory.configure({ providerInstanceIds: [codexInstanceId] }),
        );
        expect(result._tag).toBe("Failure");
        expect((yield* settings.getSettings).memory.supermemory.enabled).toBe(false);
      }).pipe(Effect.provide(serviceLayer));
    }),
  );
});
