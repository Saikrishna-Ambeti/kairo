import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as NodeSqliteClient from "@kairo/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";

it.layer(Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" }), NodeServices.layer))(
  "artifact file migration",
  (it) => {
    it.effect("backfills current Office files and skips deleted or missing files", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "kairo-artifact-backfill-" });
        yield* runMigrations({ toMigrationInclusive: 58 });
        yield* fs.makeDirectory(path.join(root, "artifacts"));
        for (const name of ["deck.pptx", "budget.xlsx", "rows.csv"]) {
          yield* fs.writeFileString(path.join(root, "artifacts", name), name);
        }

        yield* sql`
        INSERT INTO projection_projects (
          project_id, title, workspace_root, scripts_json, created_at, updated_at
        ) VALUES (
          'project-1', 'Finance', ${root}, '[]',
          '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
        )
      `;
        yield* sql`
        INSERT INTO projection_threads (
          thread_id, project_id, title, model_selection_json, created_at, updated_at
        ) VALUES (
          'thread-1', 'project-1', 'Quarterly results',
          '{"instanceId":"codex","model":"test"}',
          '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
        )
      `;
        const firstFiles =
          '[{"path":"artifacts/deck.pptx","kind":"added","additions":1,"deletions":0},{"path":"artifacts/budget.xlsx","kind":"added","additions":1,"deletions":0},{"path":"artifacts/rows.csv","kind":"added","additions":1,"deletions":0},{"path":"artifacts/removed.xlsx","kind":"added","additions":1,"deletions":0}]';
        const laterFiles =
          '[{"path":"artifacts/removed.xlsx","kind":"deleted","additions":0,"deletions":1}]';
        yield* sql`
        INSERT INTO projection_turns (
          thread_id, turn_id, state, requested_at, completed_at,
          checkpoint_turn_count, checkpoint_files_json
        ) VALUES (
          'thread-1', 'turn-1', 'completed', '2026-09-01T00:00:00.000Z',
          '2026-09-01T00:00:01.000Z', 1, ${firstFiles}
        ), (
          'thread-1', 'turn-2', 'completed', '2026-09-01T00:00:02.000Z',
          '2026-09-01T00:00:03.000Z', 2, ${laterFiles}
        )
      `;

        yield* runMigrations({ toMigrationInclusive: 59 });
        const rows = yield* sql<{
          readonly kind: string;
          readonly fileName: string;
          readonly sizeBytes: number;
        }>`
        SELECT kind, file_name AS "fileName", size_bytes AS "sizeBytes"
        FROM artifact_metadata ORDER BY file_name
      `;
        assert.deepEqual(
          rows.map((row) => [row.kind, row.fileName, row.sizeBytes]),
          [
            ["spreadsheet", "budget.xlsx", 11],
            ["presentation", "deck.pptx", 9],
            ["csv", "rows.csv", 8],
          ],
        );
      }),
    );
  },
);
