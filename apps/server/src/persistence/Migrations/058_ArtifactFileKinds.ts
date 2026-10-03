import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE artifact_metadata_next (
      thread_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      checkpoint_turn_count INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('document', 'presentation', 'spreadsheet', 'csv', 'pdf')),
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      search_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, relative_path)
    )
  `;

  yield* sql`
    INSERT INTO artifact_metadata_next (
      thread_id, project_id, turn_id, checkpoint_turn_count, kind, title,
      file_name, relative_path, size_bytes, search_text, created_at, updated_at
    )
    SELECT
      thread_id, project_id, turn_id, checkpoint_turn_count, kind, title,
      file_name, relative_path, size_bytes, search_text, created_at, updated_at
    FROM artifact_metadata
  `;

  yield* sql`DROP TABLE artifact_metadata`;
  yield* sql`ALTER TABLE artifact_metadata_next RENAME TO artifact_metadata`;
  yield* sql`
    CREATE INDEX idx_artifact_metadata_thread_updated
    ON artifact_metadata(thread_id, updated_at DESC)
  `;
  yield* sql`
    CREATE INDEX idx_artifact_metadata_project_updated
    ON artifact_metadata(project_id, updated_at DESC)
  `;
  yield* sql`
    CREATE INDEX idx_artifact_metadata_kind_updated
    ON artifact_metadata(kind, updated_at DESC)
  `;
});
