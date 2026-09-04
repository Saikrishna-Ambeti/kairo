import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Kairo previously used migration IDs 42 and 43 for its artifact and scheduled-task tables.
 * Upstream later assigned those IDs to projection columns. Existing Kairo databases therefore
 * skip the upstream migrations by numeric ID; this idempotent pass restores the missing columns.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "linked_pull_request_json")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN linked_pull_request_json TEXT
    `;
  }

  if (!columns.some((column) => column.name === "unsettled_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN unsettled_at TEXT
    `;
  }
});
