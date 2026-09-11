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
      yield* sql`INSERT INTO scheduled_tasks (task_id, revision, data_json, deleted, updated_at)
        VALUES ('preserved-task', 7, '{"title":"Keep this task"}', 0, '2026-09-10T00:00:00Z')`;
      yield* runMigrations({ toMigrationInclusive: 53 });
      const tasks = yield* sql<{ readonly revision: number; readonly data_json: string }>`
        SELECT revision, data_json FROM scheduled_tasks WHERE task_id = 'preserved-task'
      `;
      assert.deepStrictEqual(tasks, [{ revision: 7, data_json: '{"title":"Keep this task"}' }]);

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(columns.some((column) => column.name === "linked_pull_request_json"));
      assert.ok(columns.some((column) => column.name === "unsettled_at"));
      assert.ok(columns.some((column) => column.name === "branch_pull_request_json"));
      assert.ok(columns.some((column) => column.name === "active_order_key"));
      const pullRequestTables = yield* sql<{ readonly name: string }>`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projection_thread_pull_requests'
      `;
      assert.equal(pullRequestTables.length, 1);
      const preserved = yield* sql<{ readonly migration_id: number; readonly name: string }>`
        SELECT migration_id, name FROM effect_sql_migrations WHERE migration_id BETWEEN 48 AND 50 ORDER BY migration_id
      `;
      assert.deepStrictEqual(
        preserved.map((row) => row.name),
        ["KairoUpstreamSchemaReconciliation", "ArtifactMetadata", "ScheduledTasks"],
      );

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
