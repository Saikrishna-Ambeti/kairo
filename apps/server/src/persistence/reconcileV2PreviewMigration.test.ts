import { assert, describe, it } from "@effect/vitest";
import * as NodeSqliteClient from "@kairo/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as SqlClient from "effect/sql/SqlClient";

import { runMigrations } from "./Migrations.ts";

const seedPreview = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* runMigrations({ toMigrationInclusive: 62 });
  yield* sql`DELETE FROM effect_sql_migrations WHERE migration_id = 53`;
  yield* sql`UPDATE effect_sql_migrations SET migration_id = 53 WHERE migration_id = 62`;
  yield* sql`
    INSERT INTO orchestration_v2_legacy_imports
      (thread_id, source_updated_at, shell_imported_at, transcript_imported_at, imported_message_count)
    VALUES ('preview-thread', '2026-09-15', '2026-09-15', '2026-09-16', 42)
  `;
  yield* sql`
    UPDATE effect_sql_migrations SET created_at = '2026-09-15 00:00:00' WHERE migration_id = 53
  `;
});

describe("upstream V2 preview database", () => {
  it.effect("rejects a foreign migration ledger without changing its import progress", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* seedPreview;
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      const imports = yield* sql`SELECT * FROM orchestration_v2_legacy_imports`;

      const result = yield* Effect.exit(runMigrations());
      if (!Exit.isFailure(result)) throw new Error("Expected the foreign ledger to be rejected.");
      assert.match(String(result.cause), /created by another build/);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
        history,
      );
      assert.deepStrictEqual(yield* sql`SELECT * FROM orchestration_v2_legacy_imports`, imports);
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );
});
