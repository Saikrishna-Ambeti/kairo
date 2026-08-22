import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/unstable/ai";

import { SupermemoryService } from "../../../memory/SupermemoryService.ts";
import { MemoryToolkitRegistrationLive } from "../../McpHttpServer.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const client = McpSchema.McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "memory-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const invocation = (capabilities: ReadonlySet<McpInvocationContext.McpCapability>) => ({
  environmentId: EnvironmentId.make("environment-memory-test"),
  threadId: ThreadId.make("thread-memory-test"),
  providerSessionId: "provider-session-memory-test",
  providerInstanceId: ProviderInstanceId.make("codex"),
  capabilities,
  issuedAt: 1,
});

it.effect("routes memory tools only for sessions with the memory capability", () => {
  const saved: string[] = [];
  const service = SupermemoryService.of({
    provisionAccess: () => Effect.die("unused"),
    getStatus: Effect.die("unused"),
    configure: () => Effect.die("unused"),
    disable: Effect.die("unused"),
    save: (_providerInstanceId, content) =>
      Effect.sync(() => {
        saved.push(content);
        return { saved: true };
      }),
    recall: () => Effect.die("unused"),
    context: () => Effect.die("unused"),
  });
  const testLayer = MemoryToolkitRegistrationLive.pipe(
    Layer.provideMerge(McpServer.McpServer.layer),
    Layer.provide(Layer.succeed(SupermemoryService, service)),
  );

  return Effect.gen(function* () {
    const server = yield* McpServer.McpServer;

    const denied = yield* server
      .callTool({
        name: "memory",
        arguments: { content: "keep this" },
      })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation(new Set())),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(denied.isError).toBe(true);
    expect(saved).toEqual([]);

    const allowed = yield* server
      .callTool({
        name: "memory",
        arguments: { content: "keep this" },
      })
      .pipe(
        Effect.provideService(
          McpInvocationContext.McpInvocationContext,
          invocation(new Set(["memory"])),
        ),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(allowed.isError).not.toBe(true);
    expect(saved).toEqual(["keep this"]);
  }).pipe(Effect.provide(testLayer));
});
