import { WS_METHODS } from "@kairo/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";

import type { ConnectionCatalogEntry } from "./catalog.ts";
import type {
  ConnectionAttemptError,
  ConnectionAttemptStage,
  PreparedConnection,
} from "./model.ts";
import * as ConnectionResolver from "./resolver.ts";
import * as RpcSession from "../rpc/session.ts";
import { CloudSession } from "../platform/capabilities.ts";

export type ConnectionDriverProgress =
  | {
      readonly stage: "preparing";
    }
  | {
      readonly stage: Exclude<ConnectionAttemptStage, "preparing">;
      readonly prepared: PreparedConnection;
    };

export interface EnvironmentConnectionLease {
  readonly prepared: PreparedConnection;
  readonly session: RpcSession.RpcSession;
}

export class ConnectionDriver extends Context.Service<
  ConnectionDriver,
  {
    readonly connect: (
      entry: ConnectionCatalogEntry,
      reportProgress: (progress: ConnectionDriverProgress) => Effect.Effect<void>,
    ) => Effect.Effect<EnvironmentConnectionLease, ConnectionAttemptError, Scope.Scope>;
  }
>()("@kairo/client-runtime/connection/driver/ConnectionDriver") {}

export function provisionMemoryAccess<E, E2>(
  clerkToken: Effect.Effect<string, E>,
  provision: (clerkToken: string) => Effect.Effect<unknown, E2>,
): Effect.Effect<void> {
  return clerkToken.pipe(Effect.flatMap(provision), Effect.ignore);
}

export const make = Effect.gen(function* () {
  const resolver = yield* ConnectionResolver.ConnectionResolver;
  const sessions = yield* RpcSession.RpcSessionFactory;
  const cloudSession = yield* CloudSession;

  const connect = Effect.fn("ConnectionDriver.connect")(function* (
    entry: ConnectionCatalogEntry,
    reportProgress: (progress: ConnectionDriverProgress) => Effect.Effect<void>,
  ) {
    const target = entry.target;
    yield* Effect.annotateCurrentSpan({
      "connection.environment.id": target.environmentId,
      "connection.target.kind": target._tag,
    });
    yield* reportProgress({ stage: "preparing" });
    const prepared = yield* resolver.prepare(entry);
    yield* reportProgress({ stage: "opening", prepared });
    const session = yield* sessions.connect(prepared);
    yield* reportProgress({ stage: "synchronizing", prepared });
    yield* session.ready;
    yield* provisionMemoryAccess(cloudSession.clerkToken, (clerkToken) =>
      session.client[WS_METHODS.serverProvisionMemoryAccess]({ clerkToken }),
    ).pipe(Effect.forkScoped);
    return { prepared, session } satisfies EnvironmentConnectionLease;
  });

  return ConnectionDriver.of({ connect });
});

export const layer = Layer.effect(ConnectionDriver, make);
