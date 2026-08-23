import {
  CommandId,
  MessageId,
  ScheduledTaskError,
  ScheduledTaskId,
  ScheduledTaskRoutine as ScheduledTaskRoutineSchema,
  ScheduledTaskRunReceipt as ScheduledTaskRunReceiptSchema,
  ScheduledTaskRunId,
  ThreadId,
  type ScheduledTaskCommand,
  type ScheduledTaskDispatchResult,
  type ScheduledTaskExternalTriggerInput,
  type ScheduledTaskRoutine,
  type ScheduledTaskRunReceipt,
  type ScheduledTaskSnapshot,
  type ScheduledTaskTriggerKind,
} from "@kairo/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import {
  dueOccurrences,
  isValidTimeZone,
  nextScheduledOccurrence,
  overlapDisposition,
  parseCron,
  restartRunDisposition,
  zonedMinute,
} from "./schedule.ts";

interface ScheduledTaskRow {
  readonly task_id: string;
  readonly revision: number;
  readonly data_json: string;
  readonly deleted: number;
}

interface ScheduledTaskRunRow {
  readonly data_json: string;
}

interface SequenceRow {
  readonly sequence: number;
}

interface RevisionRow {
  readonly revision: number;
}

interface CountRow {
  readonly count: number;
}

const internalError = (message: string) => new ScheduledTaskError({ code: "INTERNAL", message });
const isoFromMillis = (millis: number) => DateTime.formatIso(DateTime.makeUnsafe(millis));
const TaskJson = Schema.fromJsonString(ScheduledTaskRoutineSchema);
const RunJson = Schema.fromJsonString(ScheduledTaskRunReceiptSchema);
const UnknownJson = Schema.fromJsonString(Schema.Unknown);
const encodeTask = Schema.encodeSync(TaskJson);
const encodeRun = Schema.encodeSync(RunJson);
const encodeUnknown = Schema.encodeSync(UnknownJson);
const decodeTaskJson = Schema.decodeUnknownEffect(TaskJson);
const decodeRunJson = Schema.decodeUnknownEffect(RunJson);

const validateSchedule = (task: Pick<ScheduledTaskRoutine, "timezone" | "trigger">) => {
  if (!isValidTimeZone(task.timezone)) {
    return Effect.fail(
      new ScheduledTaskError({
        code: "INVALID_TIMEZONE",
        message: `Unknown timezone: ${task.timezone}.`,
      }),
    );
  }
  if (task.trigger.kind === "cron" && parseCron(task.trigger.expression) === null) {
    return Effect.fail(
      new ScheduledTaskError({
        code: "INVALID_SCHEDULE",
        message: "Cron schedules need five valid fields: minute hour day month weekday.",
      }),
    );
  }
  if (task.trigger.kind === "one-time" && !Number.isFinite(Date.parse(task.trigger.at))) {
    return Effect.fail(
      new ScheduledTaskError({ code: "INVALID_SCHEDULE", message: "One-time date is invalid." }),
    );
  }
  return Effect.void;
};

function taskNextRunAt(task: ScheduledTaskRoutine, afterMs: number): string | null {
  if (!task.enabled) return null;
  const next = nextScheduledOccurrence({
    trigger: task.trigger,
    timeZone: task.timezone,
    afterMs,
    ...(task.lastRunAt === null
      ? {}
      : { dedupeLocalKey: zonedMinute(Date.parse(task.lastRunAt), task.timezone).key }),
  });
  return next === null ? null : isoFromMillis(next);
}

export interface ScheduledTaskServiceShape {
  readonly getSnapshot: Effect.Effect<ScheduledTaskSnapshot, ScheduledTaskError>;
  readonly dispatch: (
    command: ScheduledTaskCommand,
  ) => Effect.Effect<ScheduledTaskDispatchResult, ScheduledTaskError>;
  readonly fireExternal: (
    input: ScheduledTaskExternalTriggerInput,
  ) => Effect.Effect<ScheduledTaskDispatchResult, ScheduledTaskError>;
  readonly tick: Effect.Effect<void, ScheduledTaskError>;
}

export class ScheduledTaskService extends Context.Service<
  ScheduledTaskService,
  ScheduledTaskServiceShape
>()("kairo/scheduledTasks/ScheduledTaskService") {}

const makeScheduledTaskService = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const crypto = yield* Crypto.Crypto;
  const orchestration = yield* OrchestrationEngineService;
  const snapshots = yield* ProjectionSnapshotQuery;

  const uuid = crypto.randomUUIDv4.pipe(
    Effect.mapError(() => internalError("Could not generate a scheduled-task identifier.")),
  );
  const nowIso = Effect.map(Clock.currentTimeMillis, isoFromMillis);

  const decodeTask = (json: string) =>
    decodeTaskJson(json).pipe(
      Effect.mapError(() => internalError("Stored scheduled-task data does not match its schema.")),
    );
  const decodeRun = (json: string) =>
    decodeRunJson(json).pipe(
      Effect.mapError(() => internalError("Stored scheduled-task run does not match its schema.")),
    );

  const findTask = (taskId: ScheduledTaskId, includeDeleted = false) =>
    Effect.gen(function* () {
      const rows = yield* sql<ScheduledTaskRow>`
        SELECT task_id, revision, data_json, deleted
        FROM scheduled_tasks
        WHERE task_id = ${taskId}
        LIMIT 1
      `;
      const row = rows[0];
      if (row === undefined || (!includeDeleted && row.deleted !== 0)) {
        return yield* new ScheduledTaskError({
          code: "NOT_FOUND",
          message: "Scheduled task was not found.",
        });
      }
      return yield* decodeTask(row.data_json);
    });

  const requireRevision = (task: ScheduledTaskRoutine, expectedRevision: number) =>
    task.revision === expectedRevision
      ? Effect.void
      : Effect.fail(
          new ScheduledTaskError({
            code: "CONFLICT",
            message: "Routine changed on another tab or device. Latest version was loaded.",
            currentRevision: task.revision,
          }),
        );

  const appendEvent = (input: {
    readonly taskId: ScheduledTaskId | null;
    readonly eventType: string;
    readonly commandId: CommandId | null;
    readonly occurredAt: string;
    readonly payload: unknown;
  }) =>
    Effect.gen(function* () {
      const eventId = yield* uuid;
      const rows = yield* sql<SequenceRow>`
        INSERT INTO scheduled_task_events (
          event_id, task_id, event_type, command_id, occurred_at, payload_json
        ) VALUES (
          ${eventId}, ${input.taskId}, ${input.eventType}, ${input.commandId},
          ${input.occurredAt}, ${encodeUnknown(input.payload)}
        )
        RETURNING sequence
      `;
      return rows[0]?.sequence ?? 0;
    });

  const saveTask = (task: ScheduledTaskRoutine, deleted = false) =>
    sql`
      INSERT INTO scheduled_tasks (task_id, revision, data_json, deleted, updated_at)
      VALUES (${task.id}, ${task.revision}, ${encodeTask(task)}, ${deleted ? 1 : 0}, ${task.updatedAt})
      ON CONFLICT(task_id) DO UPDATE SET
        revision = excluded.revision,
        data_json = excluded.data_json,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at
    `.pipe(Effect.asVoid);

  const saveExistingTask = (
    task: ScheduledTaskRoutine,
    expectedRevision: number,
    deleted = false,
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<RevisionRow>`
        UPDATE scheduled_tasks
        SET revision = ${task.revision}, data_json = ${encodeTask(task)},
            deleted = ${deleted ? 1 : 0}, updated_at = ${task.updatedAt}
        WHERE task_id = ${task.id} AND revision = ${expectedRevision}
        RETURNING revision
      `;
      if (rows.length === 0) {
        return yield* new ScheduledTaskError({
          code: "CONFLICT",
          message: "Routine changed on another tab or device. Latest version was loaded.",
        });
      }
    });

  const saveRun = (run: ScheduledTaskRunReceipt) =>
    sql`
      INSERT INTO scheduled_task_runs (
        run_id, task_id, status, data_json, scheduled_for, created_at, completed_at
      ) VALUES (
        ${run.id}, ${run.taskId}, ${run.status}, ${encodeRun(run)},
        ${run.scheduledFor}, ${run.startedAt ?? run.scheduledFor}, ${run.completedAt}
      )
      ON CONFLICT(run_id) DO UPDATE SET
        status = excluded.status,
        data_json = excluded.data_json,
        completed_at = excluded.completed_at
    `.pipe(Effect.asVoid);

  const getSnapshot: ScheduledTaskServiceShape["getSnapshot"] = Effect.gen(function* () {
    const [taskRows, runRows, revisionRows] = yield* Effect.all([
      sql<ScheduledTaskRow>`
        SELECT task_id, revision, data_json, deleted
        FROM scheduled_tasks
        WHERE deleted = 0
        ORDER BY updated_at DESC, task_id ASC
      `,
      sql<ScheduledTaskRunRow>`
        SELECT data_json
        FROM scheduled_task_runs
        ORDER BY COALESCE(completed_at, created_at) DESC, run_id DESC
        LIMIT 200
      `,
      sql<SequenceRow>`SELECT COALESCE(MAX(sequence), 0) AS sequence FROM scheduled_task_events`,
    ]);
    const tasks = yield* Effect.forEach(taskRows, (row) => decodeTask(row.data_json));
    const runs = yield* Effect.forEach(runRows, (row) => decodeRun(row.data_json));
    return { revision: revisionRows[0]?.sequence ?? 0, tasks, runs };
  }).pipe(
    Effect.catchTag("SqlError", () =>
      Effect.fail(internalError("Could not load scheduled tasks.")),
    ),
  );

  const queueRun = (input: {
    readonly task: ScheduledTaskRoutine;
    readonly scheduledFor: string;
    readonly triggerKind: ScheduledTaskTriggerKind;
    readonly reason?: string;
    readonly forceSkipped?: boolean;
  }) =>
    Effect.gen(function* () {
      const activeRows = yield* sql<CountRow>`
        SELECT COUNT(*) AS count
        FROM scheduled_task_runs
        WHERE task_id = ${input.task.id} AND status IN ('queued', 'running')
      `;
      const overlapping = (activeRows[0]?.count ?? 0) > 0;
      const createdAt = yield* nowIso;
      const runId = ScheduledTaskRunId.make(yield* uuid);
      const skipped =
        input.forceSkipped === true ||
        overlapDisposition(input.task.executionPolicy.overlap, overlapping) === "skip";
      const run: ScheduledTaskRunReceipt = {
        id: runId,
        taskId: input.task.id,
        taskTitle: input.task.title,
        status: skipped ? "skipped" : "queued",
        triggerKind: input.triggerKind,
        scheduledFor: input.scheduledFor,
        startedAt: null,
        completedAt: skipped ? createdAt : null,
        threadId: null,
        reason: skipped ? (input.reason ?? "Previous run still active.") : (input.reason ?? null),
        reviewedAt: null,
      };
      yield* saveRun(run);
      const sequence = yield* appendEvent({
        taskId: input.task.id,
        eventType: skipped ? "run-skipped" : "run-queued",
        commandId: null,
        occurredAt: createdAt,
        payload: run,
      });
      return { sequence, run };
    });

  const completeRun = (
    run: ScheduledTaskRunReceipt,
    input: {
      readonly status: "succeeded" | "failed";
      readonly reason?: string;
    },
  ) =>
    Effect.gen(function* () {
      const completedAt = yield* nowIso;
      const completed: ScheduledTaskRunReceipt = {
        ...run,
        status: input.status,
        completedAt,
        reason: input.reason ?? run.reason,
      };
      yield* saveRun(completed);
      yield* appendEvent({
        taskId: run.taskId,
        eventType: "run-completed",
        commandId: null,
        occurredAt: completedAt,
        payload: completed,
      });
    });

  const reconcileRunning = Effect.gen(function* () {
    const rows = yield* sql<ScheduledTaskRunRow>`
      SELECT data_json FROM scheduled_task_runs WHERE status = 'running'
    `;
    yield* Effect.forEach(
      rows,
      (row) =>
        Effect.gen(function* () {
          const run = yield* decodeRun(row.data_json);
          if (run.threadId === null) return;
          const shell = yield* snapshots.getThreadShellById(run.threadId);
          const disposition = restartRunDisposition({
            threadExists: Option.isSome(shell),
            turnState: Option.isSome(shell) ? (shell.value.latestTurn?.state ?? null) : null,
            sessionStatus: Option.isSome(shell) ? (shell.value.session?.status ?? null) : null,
          });
          if (disposition === "failed") {
            yield* completeRun(run, {
              status: "failed",
              reason: Option.isNone(shell) ? "Run thread disappeared." : "Agent run failed.",
            });
            return;
          }
          if (disposition === "succeeded") {
            yield* completeRun(run, { status: "succeeded" });
          }
        }).pipe(Effect.catch(() => Effect.void)),
      { concurrency: 4, discard: true },
    );
  });

  const startQueuedRuns = Effect.gen(function* () {
    const rows = yield* sql<ScheduledTaskRunRow>`
      SELECT data_json FROM scheduled_task_runs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 20
    `;
    yield* Effect.forEach(
      rows,
      (row) =>
        Effect.gen(function* () {
          const queued = yield* decodeRun(row.data_json);
          const runningRows = yield* sql<CountRow>`
            SELECT COUNT(*) AS count FROM scheduled_task_runs
            WHERE task_id = ${queued.taskId} AND status = 'running'
          `;
          if ((runningRows[0]?.count ?? 0) > 0) return;
          const task = yield* findTask(queued.taskId);
          const startedAt = yield* nowIso;
          const threadId = ThreadId.make(yield* uuid);
          const messageId = MessageId.make(yield* uuid);
          const commandId = CommandId.make(yield* uuid);
          const permissions =
            task.permissions.length === 0
              ? "No pre-approved capabilities. Ask in the chat composer before protected actions."
              : `Approved capabilities for this routine:\n${task.permissions.map((permission) => `- ${permission.capability}: ${permission.scope}`).join("\n")}\nAsk in the chat composer before actions outside these scopes.`;
          const prompt = `${task.prompt}\n\nScheduled routine policy:\n${permissions}`;
          const running: ScheduledTaskRunReceipt = {
            ...queued,
            status: "running",
            startedAt,
            threadId,
          };
          yield* saveRun(running);
          yield* appendEvent({
            taskId: task.id,
            eventType: "run-started",
            commandId: null,
            occurredAt: startedAt,
            payload: running,
          });
          yield* orchestration
            .dispatch({
              type: "thread.turn.start",
              commandId,
              threadId,
              message: { messageId, role: "user", text: prompt, attachments: [] },
              modelSelection: task.modelSelection,
              titleSeed: task.title,
              runtimeMode: task.runtimeMode,
              interactionMode: task.interactionMode,
              bootstrap: {
                createThread: {
                  projectId: task.projectId,
                  title: task.title,
                  modelSelection: task.modelSelection,
                  runtimeMode: task.runtimeMode,
                  interactionMode: task.interactionMode,
                  branch: null,
                  worktreePath: null,
                  createdAt: startedAt,
                },
              },
              createdAt: startedAt,
            })
            .pipe(
              Effect.catch((error) =>
                completeRun(running, {
                  status: "failed",
                  reason: error.message || "Agent session could not start.",
                }),
              ),
            );
        }),
      { concurrency: 1, discard: true },
    );
  });

  const tick: ScheduledTaskServiceShape["tick"] = Effect.gen(function* () {
    yield* reconcileRunning;
    const currentMs = yield* Clock.currentTimeMillis;
    const rows = yield* sql<ScheduledTaskRow>`
      SELECT task_id, revision, data_json, deleted
      FROM scheduled_tasks
      WHERE deleted = 0
    `;
    for (const row of rows) {
      const task = yield* decodeTask(row.data_json);
      if (!task.enabled || task.nextRunAt === null) continue;
      const nextRunAtMs = Date.parse(task.nextRunAt);
      if (!Number.isFinite(nextRunAtMs) || nextRunAtMs > currentMs) continue;
      const missed = dueOccurrences({
        trigger: task.trigger,
        timeZone: task.timezone,
        nextRunAtMs,
        nowMs: currentMs,
        missedRuns: task.executionPolicy.missedRuns,
      });
      const trulyMissed = currentMs - nextRunAtMs > 90_000;
      if (task.executionPolicy.missedRuns === "skip" && trulyMissed) {
        yield* queueRun({
          task,
          scheduledFor: task.nextRunAt,
          triggerKind: task.trigger.kind,
          reason: "Missed while Kairo was unavailable.",
          forceSkipped: true,
        });
      } else {
        for (const scheduledForMs of missed) {
          yield* queueRun({
            task,
            scheduledFor: isoFromMillis(scheduledForMs),
            triggerKind: task.trigger.kind,
          });
        }
      }
      const lastOccurrence = missed.at(-1) ?? nextRunAtMs;
      const updatedAt = yield* nowIso;
      const nextTask: ScheduledTaskRoutine = {
        ...task,
        revision: task.revision + 1,
        lastRunAt: isoFromMillis(lastOccurrence),
        updatedAt,
        nextRunAt: null,
      };
      const withNext = {
        ...nextTask,
        nextRunAt: taskNextRunAt(nextTask, Math.max(currentMs, lastOccurrence)),
      };
      const saved = yield* saveExistingTask(withNext, task.revision).pipe(
        Effect.as(true),
        Effect.catchTag("ScheduledTaskError", () => Effect.succeed(false)),
      );
      if (!saved) continue;
      yield* appendEvent({
        taskId: task.id,
        eventType: "updated",
        commandId: null,
        occurredAt: updatedAt,
        payload: withNext,
      });
    }
    yield* startQueuedRuns;
  }).pipe(
    Effect.catchTag("SqlError", () => Effect.fail(internalError("Scheduled-task tick failed."))),
  );

  const dispatch: ScheduledTaskServiceShape["dispatch"] = (command) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          if (command.type === "scheduled-task.run.review") {
            const rows = yield* sql<ScheduledTaskRunRow>`
              SELECT data_json FROM scheduled_task_runs WHERE run_id = ${command.runId} LIMIT 1
            `;
            const row = rows[0];
            if (row === undefined) {
              return yield* new ScheduledTaskError({
                code: "NOT_FOUND",
                message: "Run was not found.",
              });
            }
            const run = yield* decodeRun(row.data_json);
            const reviewed = { ...run, reviewedAt: command.createdAt };
            yield* saveRun(reviewed);
            const revision = yield* appendEvent({
              taskId: run.taskId,
              eventType: "run-reviewed",
              commandId: command.commandId,
              occurredAt: command.createdAt,
              payload: reviewed,
            });
            return { revision, run: reviewed };
          }

          if (command.type === "scheduled-task.create") {
            const existing = yield* sql<CountRow>`
              SELECT COUNT(*) AS count FROM scheduled_tasks WHERE task_id = ${command.task.id}
            `;
            if ((existing[0]?.count ?? 0) > 0) {
              return yield* new ScheduledTaskError({
                code: "CONFLICT",
                message: "Routine ID already exists.",
              });
            }
            const task: ScheduledTaskRoutine = {
              ...command.task,
              revision: 1,
              nextRunAt: null,
              lastRunAt: null,
              createdAt: command.createdAt,
              updatedAt: command.createdAt,
            };
            yield* validateSchedule(task);
            const scheduled = {
              ...task,
              nextRunAt: taskNextRunAt(task, Date.parse(command.createdAt) - 1),
            };
            yield* saveTask(scheduled);
            const revision = yield* appendEvent({
              taskId: task.id,
              eventType: "created",
              commandId: command.commandId,
              occurredAt: command.createdAt,
              payload: scheduled,
            });
            return { revision, task: scheduled };
          }

          const task = yield* findTask(command.taskId);
          yield* requireRevision(task, command.expectedRevision);

          if (command.type === "scheduled-task.run-now") {
            const queued = yield* queueRun({
              task,
              scheduledFor: command.createdAt,
              triggerKind: "manual",
            });
            return { revision: queued.sequence, task, run: queued.run };
          }

          if (command.type === "scheduled-task.delete") {
            const deleted = { ...task, revision: task.revision + 1, updatedAt: command.createdAt };
            yield* saveExistingTask(deleted, command.expectedRevision, true);
            const revision = yield* appendEvent({
              taskId: task.id,
              eventType: "deleted",
              commandId: command.commandId,
              occurredAt: command.createdAt,
              payload: deleted,
            });
            return { revision };
          }

          if (command.type === "scheduled-task.duplicate") {
            const existing = yield* sql<CountRow>`
              SELECT COUNT(*) AS count FROM scheduled_tasks WHERE task_id = ${command.duplicateId}
            `;
            if ((existing[0]?.count ?? 0) > 0) {
              return yield* new ScheduledTaskError({
                code: "CONFLICT",
                message: "Duplicate routine ID already exists.",
              });
            }
            const duplicate: ScheduledTaskRoutine = {
              ...task,
              id: command.duplicateId,
              title: `${task.title} copy`,
              enabled: false,
              revision: 1,
              nextRunAt: null,
              lastRunAt: null,
              createdAt: command.createdAt,
              updatedAt: command.createdAt,
            };
            yield* saveTask(duplicate);
            const revision = yield* appendEvent({
              taskId: duplicate.id,
              eventType: "duplicated",
              commandId: command.commandId,
              occurredAt: command.createdAt,
              payload: duplicate,
            });
            return { revision, task: duplicate };
          }

          let updated: ScheduledTaskRoutine;
          let eventType: string;
          switch (command.type) {
            case "scheduled-task.update":
              updated = {
                ...task,
                ...(command.patch.title !== undefined ? { title: command.patch.title } : {}),
                ...(command.patch.prompt !== undefined ? { prompt: command.patch.prompt } : {}),
                ...(command.patch.trigger !== undefined ? { trigger: command.patch.trigger } : {}),
                ...(command.patch.timezone !== undefined
                  ? { timezone: command.patch.timezone }
                  : {}),
                ...(command.patch.executionPolicy !== undefined
                  ? { executionPolicy: command.patch.executionPolicy }
                  : {}),
                ...(command.patch.permissions !== undefined
                  ? { permissions: command.patch.permissions }
                  : {}),
                ...(command.patch.modelSelection !== undefined
                  ? { modelSelection: command.patch.modelSelection }
                  : {}),
                ...(command.patch.runtimeMode !== undefined
                  ? { runtimeMode: command.patch.runtimeMode }
                  : {}),
                ...(command.patch.interactionMode !== undefined
                  ? { interactionMode: command.patch.interactionMode }
                  : {}),
                revision: task.revision + 1,
                updatedAt: command.createdAt,
              };
              eventType = "updated";
              break;
            case "scheduled-task.pause":
              updated = {
                ...task,
                enabled: false,
                nextRunAt: null,
                revision: task.revision + 1,
                updatedAt: command.createdAt,
              };
              eventType = "paused";
              break;
            case "scheduled-task.resume":
              updated = {
                ...task,
                enabled: true,
                revision: task.revision + 1,
                updatedAt: command.createdAt,
              };
              eventType = "resumed";
              break;
            case "scheduled-task.permission.revoke":
              updated = {
                ...task,
                permissions: task.permissions.filter(
                  (permission) => permission.id !== command.permissionId,
                ),
                revision: task.revision + 1,
                updatedAt: command.createdAt,
              };
              eventType = "permission-revoked";
              break;
          }
          yield* validateSchedule(updated);
          const scheduled = {
            ...updated,
            nextRunAt: updated.enabled
              ? taskNextRunAt(updated, Date.parse(command.createdAt))
              : null,
          };
          yield* saveExistingTask(scheduled, command.expectedRevision);
          const revision = yield* appendEvent({
            taskId: task.id,
            eventType,
            commandId: command.commandId,
            occurredAt: command.createdAt,
            payload: scheduled,
          });
          return { revision, task: scheduled };
        }),
      )
      .pipe(
        Effect.tap(() => startQueuedRuns.pipe(Effect.forkDetach)),
        Effect.catchTag("SqlError", (error) =>
          Effect.fail(internalError(`Scheduled-task command failed: ${error.message}`)),
        ),
      );

  const fireExternal: ScheduledTaskServiceShape["fireExternal"] = (input) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const task = yield* findTask(input.taskId);
          if (task.trigger.kind !== input.source) {
            return yield* new ScheduledTaskError({
              code: "TRIGGER_MISMATCH",
              message: `Routine expects ${task.trigger.kind}, not ${input.source}.`,
            });
          }
          const existing = yield* sql<CountRow>`
            SELECT COUNT(*) AS count FROM scheduled_task_external_events
            WHERE source = ${input.source} AND event_id = ${input.eventId}
          `;
          if ((existing[0]?.count ?? 0) > 0) {
            return { revision: (yield* getSnapshot).revision, task };
          }
          yield* sql`
            INSERT INTO scheduled_task_external_events (source, event_id, task_id, received_at)
            VALUES (${input.source}, ${input.eventId}, ${input.taskId}, ${input.occurredAt})
          `;
          const queued = yield* queueRun({
            task,
            scheduledFor: input.occurredAt,
            triggerKind: input.source,
            reason: `Triggered by ${input.source} event ${input.eventId}.`,
          });
          return { revision: queued.sequence, task, run: queued.run };
        }),
      )
      .pipe(
        Effect.tap(() => startQueuedRuns.pipe(Effect.forkDetach)),
        Effect.catchTag("SqlError", () => Effect.fail(internalError("External trigger failed."))),
      );

  yield* tick.pipe(
    Effect.catch((error) => Effect.logWarning("Initial scheduled-task tick failed", { error })),
  );
  yield* tick.pipe(
    Effect.catch((error) => Effect.logWarning("Scheduled-task tick failed", { error })),
    Effect.repeat(Schedule.spaced(Duration.minutes(1))),
    Effect.forkDetach,
  );

  return { getSnapshot, dispatch, fireExternal, tick } satisfies ScheduledTaskServiceShape;
});

export const layer = Layer.effect(ScheduledTaskService, makeScheduledTaskService);
