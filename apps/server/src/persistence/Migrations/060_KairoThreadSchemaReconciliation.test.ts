import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as NodeSqliteClient from "@kairo/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import migrateArtifactFileKinds from "./058_ArtifactFileKinds.ts";
import migrateBackfillArtifactFileKinds from "./059_BackfillArtifactFileKinds.ts";
import migrateThreadSchema from "./060_KairoThreadSchemaReconciliation.ts";

const sqliteLayer = Layer.mergeAll(
  NodeSqliteClient.layer({ filename: ":memory:" }),
  NodeServices.layer,
);

it.effect(
  "repairs skipped projection columns after artifact migrations occupied IDs 51 and 52",
  () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 50 });
      yield* migrateArtifactFileKinds;
      yield* migrateBackfillArtifactFileKinds;
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (51, 'ArtifactFileKinds'), (52, 'BackfillArtifactFileKinds')
        `;
      yield* sql`
          INSERT INTO projection_threads (
            thread_id, project_id, title, model_selection_json, created_at, updated_at
          ) VALUES (
            'thread-1', 'project-1', 'Existing thread',
            '{"instanceId":"codex","model":"gpt-5.4"}',
            '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'
          )
        `;
      yield* sql`
          INSERT INTO artifact_metadata (
            thread_id, project_id, turn_id, checkpoint_turn_count, kind, title, file_name,
            relative_path, size_bytes, search_text, created_at, updated_at
          ) VALUES (
            'thread-1', 'project-1', 'turn-1', 1, 'presentation', 'Keep this deck', 'deck.pptx',
            'deck.pptx', 128, 'Saved deck', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'
          )
        `;
      yield* sql`
          INSERT INTO scheduled_tasks (task_id, revision, data_json, deleted, updated_at)
          VALUES ('task-1', 7, '{"title":"Keep this task"}', 0, '2026-10-01T00:00:00Z')
        `;
      yield* runMigrations({ toMigrationInclusive: 59 });
      const before = yield* sql<{
        readonly name: string;
      }>`PRAGMA table_info(projection_threads)`;
      assert.isFalse(before.some((column) => column.name === "branch_pull_request_json"));
      assert.isFalse(before.some((column) => column.name === "active_order_key"));

      assert.deepEqual(yield* runMigrations(), [[60, "KairoThreadSchemaReconciliation"]]);
      const threads = yield* sql<{
        readonly title: string;
        readonly branch_pull_request_json: string | null;
        readonly active_order_key: string | null;
        readonly updated_at: string;
      }>`
          SELECT title, branch_pull_request_json, active_order_key, updated_at
          FROM projection_threads WHERE thread_id = 'thread-1'
        `;
      assert.deepEqual(threads, [
        {
          title: "Existing thread",
          branch_pull_request_json: null,
          active_order_key: null,
          updated_at: "2026-10-01T00:00:00Z",
        },
      ]);
      const artifacts = yield* sql<{ readonly kind: string; readonly title: string }>`
          SELECT kind, title FROM artifact_metadata WHERE thread_id = 'thread-1'
        `;
      assert.deepEqual(artifacts, [{ kind: "presentation", title: "Keep this deck" }]);
      const tasks = yield* sql<{ readonly revision: number; readonly data_json: string }>`
          SELECT revision, data_json FROM scheduled_tasks WHERE task_id = 'task-1'
        `;
      assert.deepEqual(tasks, [{ revision: 7, data_json: '{"title":"Keep this task"}' }]);
      const history = yield* sql<{ readonly name: string }>`
          SELECT name FROM effect_sql_migrations WHERE migration_id IN (51, 52) ORDER BY migration_id
        `;
      assert.deepEqual(history, [
        { name: "ArtifactFileKinds" },
        { name: "BackfillArtifactFileKinds" },
      ]);
      assert.deepEqual(yield* runMigrations(), []);
    }).pipe(Effect.provide(sqliteLayer)),
);

it.effect("preserves existing branch pull requests and thread order when replayed", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* runMigrations({ toMigrationInclusive: 59 });
    const pullRequest =
      '{"repository":"acme/widgets","number":7,"url":"https://github.com/acme/widgets/pull/7"}';
    yield* sql`
          INSERT INTO projection_threads (
            thread_id, project_id, title, model_selection_json, branch_pull_request_json,
            active_order_key, created_at, updated_at
          ) VALUES (
            'thread-1', 'project-1', 'Existing thread',
            '{"instanceId":"codex","model":"gpt-5.4"}', ${pullRequest}, 'gm',
            '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'
          )
        `;
    yield* runMigrations();
    yield* migrateThreadSchema;
    const threads = yield* sql<{
      readonly branch_pull_request_json: string;
      readonly active_order_key: string;
    }>`SELECT branch_pull_request_json, active_order_key FROM projection_threads WHERE thread_id = 'thread-1'`;
    assert.deepEqual(threads, [{ branch_pull_request_json: pullRequest, active_order_key: "gm" }]);
  }).pipe(Effect.provide(sqliteLayer)),
);
