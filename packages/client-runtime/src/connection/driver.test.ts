import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { provisionMemoryAccess } from "./driver.ts";

describe("ConnectionDriver memory provisioning", () => {
  it.effect("sends the Clerk token without blocking connection failures", () =>
    Effect.gen(function* () {
      const tokens: string[] = [];
      yield* provisionMemoryAccess(Effect.succeed("clerk_session"), (clerkToken) =>
        Effect.sync(() => {
          tokens.push(clerkToken);
        }),
      );
      yield* provisionMemoryAccess(Effect.fail({ reason: "signed-out" }), () =>
        Effect.die("must not provision"),
      );
      yield* provisionMemoryAccess(Effect.succeed("clerk_refresh"), () =>
        Effect.fail({ reason: "older-server" }),
      );

      expect(tokens).toEqual(["clerk_session"]);
    }),
  );
});
