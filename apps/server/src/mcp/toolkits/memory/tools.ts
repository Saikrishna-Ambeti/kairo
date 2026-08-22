import { SupermemoryError } from "@kairo/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import { SupermemoryService } from "../../../memory/SupermemoryService.ts";

const dependencies = [McpInvocationContext.McpInvocationContext, SupermemoryService];

export const MemorySaveInput = Schema.Struct({
  content: Schema.String.annotate({
    description: "A durable fact, preference, decision, or instruction to remember.",
  }),
});

export const MemoryRecallInput = Schema.Struct({
  query: Schema.String.annotate({
    description: "What to retrieve from the user's saved memory.",
  }),
  limit: Schema.optionalKey(
    Schema.Int.annotate({ description: "Maximum results. Defaults to 10." }),
  ),
});

export const MemoryContextInput = Schema.Struct({
  query: Schema.optionalKey(
    Schema.String.annotate({
      description: "Optional topic used to focus the user's memory profile.",
    }),
  ),
});

export const MemoryTool = Tool.make("memory", {
  description:
    "Save durable user context to Kairo's hosted memory. Use for stable preferences, decisions, and facts that should survive future threads. Kairo chooses the user's private memory container server-side.",
  parameters: MemorySaveInput,
  success: Schema.Unknown,
  failure: SupermemoryError,
  dependencies,
})
  .annotate(Tool.Title, "Save memory")
  .annotate(Tool.OpenWorld, true)
  .annotate(Tool.Destructive, false);

export const RecallTool = Tool.make("recall", {
  description:
    "Search the user's hosted memory for relevant facts and prior decisions. Kairo scopes every search to the user's private server-side container.",
  parameters: MemoryRecallInput,
  success: Schema.Unknown,
  failure: SupermemoryError,
  dependencies,
})
  .annotate(Tool.Title, "Recall memory")
  .annotate(Tool.OpenWorld, true)
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

export const MemoryContextTool = Tool.make("context", {
  description:
    "Load the user's hosted memory profile, optionally focused on a topic. Kairo supplies the private container server-side.",
  parameters: MemoryContextInput,
  success: Schema.Unknown,
  failure: SupermemoryError,
  dependencies,
})
  .annotate(Tool.Title, "Get memory context")
  .annotate(Tool.OpenWorld, true)
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

export const MemoryToolkit = Toolkit.make(MemoryTool, RecallTool, MemoryContextTool);
