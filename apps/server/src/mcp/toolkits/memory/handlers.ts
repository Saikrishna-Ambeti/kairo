import { SupermemoryError } from "@kairo/contracts";
import * as Effect from "effect/Effect";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import { SupermemoryService } from "../../../memory/SupermemoryService.ts";
import { MemoryToolkit } from "./tools.ts";

const requireMemoryCapability = Effect.gen(function* () {
  const invocation = yield* McpInvocationContext.McpInvocationContext;
  if (!invocation.thread || !invocation.capabilities.has("memory")) {
    return yield* new SupermemoryError({
      message: "Hosted memory is not enabled for this provider session.",
    });
  }
  return invocation.thread;
});

export const MemoryToolkitHandlersLive = MemoryToolkit.toLayer({
  memory: (input) =>
    Effect.gen(function* () {
      const thread = yield* requireMemoryCapability;
      const supermemory = yield* SupermemoryService;
      return yield* supermemory.save(thread.providerInstanceId, input.content);
    }),
  recall: (input) =>
    Effect.gen(function* () {
      const thread = yield* requireMemoryCapability;
      const supermemory = yield* SupermemoryService;
      return yield* supermemory.recall(thread.providerInstanceId, {
        query: input.query,
        ...(input.limit === undefined ? {} : { limit: Math.max(1, Math.min(50, input.limit)) }),
      });
    }),
  context: (input) =>
    Effect.gen(function* () {
      const thread = yield* requireMemoryCapability;
      const supermemory = yield* SupermemoryService;
      return yield* supermemory.context(thread.providerInstanceId, input ?? {});
    }),
});
