import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  KAIRO_CLOUD_MEMORY_CONTENT_MAX_CHARS,
  KairoCloudMemoryRecallRequest,
  KairoCloudMemorySaveRequest,
} from "./cloudApi.ts";

const decodeSaveRequest = Schema.decodeUnknownEffect(KairoCloudMemorySaveRequest);
const decodeRecallRequest = Schema.decodeUnknownEffect(KairoCloudMemoryRecallRequest);

describe("Kairo Cloud API contracts", () => {
  it.effect("accepts bounded semantic memory inputs", () =>
    Effect.gen(function* () {
      const save = yield* decodeSaveRequest({
        content: "Remember compact answers",
      });
      const recall = yield* decodeRecallRequest({
        query: "answer style",
        limit: 3,
      });

      expect(save.content).toBe("Remember compact answers");
      expect(recall.limit).toBe(3);
    }),
  );

  it.effect("rejects oversized content and invalid recall limits", () =>
    Effect.gen(function* () {
      const oversized = yield* Effect.result(
        decodeSaveRequest({
          content: "x".repeat(KAIRO_CLOUD_MEMORY_CONTENT_MAX_CHARS + 1),
        }),
      );
      const invalidLimit = yield* Effect.result(
        decodeRecallRequest({
          query: "answer style",
          limit: 51,
        }),
      );

      expect(oversized._tag).toBe("Failure");
      expect(invalidLimit._tag).toBe("Failure");
    }),
  );
});
