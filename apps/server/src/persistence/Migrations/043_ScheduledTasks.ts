import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS scheduled_task_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      task_id TEXT,
      event_type TEXT NOT NULL,
      command_id TEXT UNIQUE,
      occurred_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_task_events_task
    ON scheduled_task_events(task_id, sequence)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      task_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_active
    ON scheduled_tasks(deleted, updated_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS scheduled_task_runs (
      run_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY(task_id) REFERENCES scheduled_tasks(task_id)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_inbox
    ON scheduled_task_runs(completed_at DESC, created_at DESC)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS scheduled_task_external_events (
      source TEXT NOT NULL,
      event_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      received_at TEXT NOT NULL,
      PRIMARY KEY(source, event_id)
    )
  `;
});
