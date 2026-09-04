import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as NodeSqliteClient from "@kairo/shared/nodeSqliteClient";
import { runMigrations } from "../Migrations.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("048_KairoUpstreamSchemaReconciliation", (it) => {
  it.effect("repairs databases whose Kairo migrations occupied upstream IDs 42 and 43", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 41 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (42, 'ArtifactMetadata'), (43, 'ScheduledTasks')
      `;

      yield* runMigrations({ toMigrationInclusive: 50 });

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(columns.some((column) => column.name === "linked_pull_request_json"));
      assert.ok(columns.some((column) => column.name === "unsettled_at"));

      const tables = yield* sql<{ readonly name: string }>`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('artifact_metadata', 'scheduled_tasks')
        ORDER BY name
      `;
      assert.deepStrictEqual(
        tables.map((table) => table.name),
        ["artifact_metadata", "scheduled_tasks"],
      );
    }),
  );
});
