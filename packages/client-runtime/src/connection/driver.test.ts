import { EnvironmentId, WS_METHODS } from "@kairo/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { make, provisionMemoryAccess } from "./driver.ts";
import { BearerConnectionTarget, PrimaryConnectionTarget } from "./model.ts";
import { ConnectionResolver } from "./resolver.ts";
import { CloudSession } from "../platform/capabilities.ts";
import { type RpcSession, RpcSessionFactory } from "../rpc/session.ts";

describe("ConnectionDriver memory provisioning", () => {
  it.effect("provisions direct and Tailscale connections with the Clerk token", () =>
    Effect.gen(function* () {
      const targets = [
        new PrimaryConnectionTarget({
          environmentId: EnvironmentId.make("direct-environment"),
          label: "Direct environment",
          httpBaseUrl: "http://127.0.0.1:3773",
          wsBaseUrl: "ws://127.0.0.1:3773/ws",
        }),
        new BearerConnectionTarget({
          environmentId: EnvironmentId.make("tailscale-environment"),
          label: "Tailscale environment",
          connectionId: "tailscale-connection",
        }),
      ] as const;
      const provisioned = yield* Deferred.make<ReadonlyArray<string>>();
      const tokens: string[] = [];
      const resolver = ConnectionResolver.of({
        prepare: (entry) =>
          Effect.succeed({
            environmentId: entry.target.environmentId,
            label: entry.target.label,
            httpBaseUrl: "https://machine.tailnet.example",
            socketUrl: "wss://machine.tailnet.example/ws",
            httpAuthorization: null,
            target: entry.target,
          }),
      });
      const session = {
        client: {
          [WS_METHODS.serverProvisionMemoryAccess]: ({ clerkToken }: { clerkToken: string }) =>
            Effect.gen(function* () {
              tokens.push(clerkToken);
              if (tokens.length === targets.length) {
                yield* Deferred.succeed(provisioned, [...tokens]);
              }
              return {};
            }),
        } as unknown as RpcSession["client"],
        initialConfig: Effect.die("unused"),
        ready: Effect.void,
        probe: Effect.void,
        closed: Effect.never,
      } satisfies RpcSession;
      const driver = yield* make.pipe(
        Effect.provideService(ConnectionResolver, resolver),
        Effect.provideService(
          RpcSessionFactory,
          RpcSessionFactory.of({ connect: () => Effect.succeed(session) }),
        ),
        Effect.provideService(
          CloudSession,
          CloudSession.of({ clerkToken: Effect.succeed("clerk-session") }),
        ),
      );

      yield* Effect.forEach(
        targets,
        (target) => driver.connect({ target, profile: Option.none() }, () => Effect.void),
        { discard: true },
      );

      expect(yield* Deferred.await(provisioned)).toEqual(["clerk-session", "clerk-session"]);
    }).pipe(Effect.scoped),
  );

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
