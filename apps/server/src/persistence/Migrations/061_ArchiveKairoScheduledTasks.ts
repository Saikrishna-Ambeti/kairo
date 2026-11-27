import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// V2 uses scheduled_tasks for its own schema. Keep Kairo's task definitions and
// receipts together so the upgrade can preserve the original schedule data.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`PRAGMA table_info(scheduled_tasks)`;
  if (!columns.some((column) => column.name === "data_json")) return;

  yield* sql`ALTER TABLE scheduled_tasks RENAME TO kairo_legacy_scheduled_tasks`;
  yield* sql`ALTER TABLE scheduled_task_events RENAME TO kairo_legacy_scheduled_task_events`;
  yield* sql`ALTER TABLE scheduled_task_runs RENAME TO kairo_legacy_scheduled_task_runs`;
  yield* sql`ALTER TABLE scheduled_task_external_events RENAME TO kairo_legacy_scheduled_task_external_events`;
});
