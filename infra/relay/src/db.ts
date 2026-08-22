import type { PgClient } from "@effect/sql-pg/PgClient";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Neon from "alchemy/Neon";
import * as Alchemy from "alchemy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { relayDatabaseMode } from "./dbConfig.ts";

export class RelayDb extends Context.Service<
  RelayDb,
  EffectPgDatabase & {
    readonly $client: PgClient;
  }
>()("kairo-relay/db/RelayDb") {}

export class RelayTransactions extends Context.Service<
  RelayTransactions,
  {
    readonly withTransaction: RelayDb["Service"]["$client"]["withTransaction"];
  }
>()("kairo-relay/db/RelayTransactions") {
  static readonly layer = Layer.effect(
    RelayTransactions,
    Effect.gen(function* () {
      const db = yield* RelayDb;
      return RelayTransactions.of({
        withTransaction: db.$client.withTransaction,
      });
    }),
  );
}

export const NeonDatabase = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  const schema = yield* Drizzle.Schema("RelaySchema", {
    schema: "./src/persistence/schema.ts",
    out: "./migrations/postgres",
    dialect: "postgres",
  });

  const mode = relayDatabaseMode(stage);
  const project =
    mode === "shared-database"
      ? yield* Neon.Project("RelayNeonProject", {
          name: "kairorelay",
          region: "aws-us-west-2",
          databaseName: "kairorelay",
          migrationsDir: schema.out,
          migrationsTable: "relay_migrations",
        }).pipe(RemovalPolicy.retain())
      : yield* Neon.Project.ref("RelayNeonProject", {
          stage: "prod",
        });
  const branch =
    mode === "stage-branch"
      ? yield* Neon.Branch("RelayNeonBranch", {
          project,
          migrationsDir: schema.out,
          migrationsTable: "relay_migrations",
        })
      : undefined;

  return { branch, project };
});

export const RelayHyperdrive = Effect.gen(function* () {
  const { branch, project } = yield* NeonDatabase;
  return yield* Cloudflare.Hyperdrive.Connection("RelayHyperdrive", {
    origin: (branch ?? project).origin,
    caching: {
      disabled: true,
    },
    originConnectionLimit: 20,
  });
});
