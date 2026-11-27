import {
  IsoDateTime,
  ModelSelection,
  ProjectId,
  ProviderInteractionMode,
  RuntimeMode,
  ScheduledTaskSchedule,
  TrimmedNonEmptyString,
} from "@kairo/contracts";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const LegacyTask = Schema.Struct({
  title: TrimmedNonEmptyString,
  prompt: TrimmedNonEmptyString,
  projectId: ProjectId,
  enabled: Schema.Boolean,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  timezone: TrimmedNonEmptyString,
  executionPolicy: Schema.Struct({
    missedRuns: Schema.Literal("skip"),
    overlap: Schema.Literal("skip"),
    isolatedWorktree: Schema.Literal(false),
  }),
  permissions: Schema.Array(Schema.Unknown),
  trigger: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("one-time"), at: IsoDateTime }),
    Schema.Struct({ kind: Schema.Literals(["daily", "weekdays"]), time: Schema.String }),
    Schema.Struct({
      kind: Schema.Literal("weekly"),
      time: Schema.String,
      dayOfWeek: Schema.Int,
    }),
  ]),
  nextRunAt: Schema.NullOr(IsoDateTime),
  lastRunAt: Schema.NullOr(IsoDateTime),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const decodeLegacyTask = Schema.decodeUnknownOption(Schema.fromJsonString(LegacyTask));
const decodeSchedule = Schema.decodeUnknownOption(ScheduledTaskSchedule);
const encodeSchedule = Schema.encodeEffect(Schema.fromJsonString(ScheduledTaskSchedule));
const encodeModelSelection = Schema.encodeEffect(Schema.fromJsonString(ModelSelection));

function convertSchedule(task: typeof LegacyTask.Type, serverTimeZone: string) {
  const trigger = task.trigger;
  if (trigger.kind === "one-time") {
    return decodeSchedule({ type: "once", runAt: trigger.at });
  }
  if (task.timezone !== serverTimeZone) return Option.none();
  return decodeSchedule({
    type: "fixed_time",
    timeOfDay: trigger.time,
    weekdays:
      trigger.kind === "weekly"
        ? [trigger.dayOfWeek]
        : trigger.kind === "weekdays"
          ? [1, 2, 3, 4, 5]
          : undefined,
  });
}

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const archive = yield* sql`
    SELECT 1 FROM sqlite_master
    WHERE type = 'table' AND name = 'kairo_legacy_scheduled_tasks'
  `;
  if (archive.length === 0) return;

  const rows = yield* sql<{
    readonly task_id: string;
    readonly data_json: string;
    readonly run_count: number;
    readonly last_status: "succeeded" | "failed" | null;
  }>`
    SELECT task.task_id, task.data_json,
      (SELECT COUNT(*) FROM kairo_legacy_scheduled_task_runs AS run
        WHERE run.task_id = task.task_id AND run.status IN ('succeeded', 'failed')) AS run_count,
      (SELECT run.status FROM kairo_legacy_scheduled_task_runs AS run
        WHERE run.task_id = task.task_id AND run.status IN ('succeeded', 'failed')
        ORDER BY run.completed_at DESC, run.run_id DESC LIMIT 1) AS last_status
    FROM kairo_legacy_scheduled_tasks AS task
    WHERE task.deleted = 0
  `;
  const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = yield* Clock.currentTimeMillis;
  let archived = 0;
  for (const row of rows) {
    const task = decodeLegacyTask(row.data_json);
    if (Option.isNone(task) || task.value.permissions.length > 0) {
      archived += 1;
      continue;
    }
    const value = task.value;
    const schedule = convertSchedule(value, serverTimeZone);
    if (Option.isNone(schedule)) {
      archived += 1;
      continue;
    }

    // The upstream scheduler runs overdue one-time tasks. Legacy imports skip missed runs.
    const enabled =
      value.enabled && (schedule.value.type !== "once" || Date.parse(schedule.value.runAt) > now);
    const scheduleJson = yield* encodeSchedule(schedule.value);
    const modelSelectionJson = yield* encodeModelSelection(value.modelSelection);
    yield* sql`
      INSERT INTO scheduled_tasks (
        task_id, title, prompt, enabled, schedule_json, project_id, thread_mode,
        workspace_strategy_json, model_selection_json, runtime_mode, interaction_mode,
        created_by, creation_source, created_at, updated_at, next_run_at, last_run_at,
        last_run_status, run_count
      ) VALUES (
        ${row.task_id}, ${value.title}, ${value.prompt}, ${enabled ? 1 : 0},
        ${scheduleJson}, ${value.projectId}, 'new_thread', '{"type":"root"}',
        ${modelSelectionJson}, ${value.runtimeMode}, ${value.interactionMode},
        'user', 'server', ${value.createdAt}, ${value.updatedAt},
        ${enabled ? value.nextRunAt : null}, ${value.lastRunAt},
        ${row.last_status ?? "never"}, ${row.run_count}
      )
      ON CONFLICT (task_id) DO NOTHING
    `;
  }

  // Unsupported triggers and policies still have their original definitions and run history.
  if (archived > 0) {
    yield* Effect.logWarning(
      `Kept ${archived} scheduled tasks in the Kairo archive because their settings could not be imported.`,
    );
  }
});
