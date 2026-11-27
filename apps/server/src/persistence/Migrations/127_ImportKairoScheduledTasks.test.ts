import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as NodeSqliteClient from "@kairo/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";

it.effect("upgrades existing Kairo schedules and preserves original task and run records", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* runMigrations({ toMigrationInclusive: 60 });
    const createdAt = "2026-10-01T00:00:00Z";
    const nextRunAt = "2027-10-01T09:30:00Z";
    const task = {
      title: "Check reports",
      prompt: "Review the reports",
      enabled: true,
      projectId: "project-1",
      modelSelection: { instanceId: "codex", model: "gpt-5.4" },
      runtimeMode: "approval-required",
      interactionMode: "default",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      executionPolicy: { missedRuns: "skip", overlap: "skip", isolatedWorktree: false },
      permissions: [],
      trigger: { kind: "weekly", time: "09:30", dayOfWeek: 5 },
      nextRunAt,
      lastRunAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    const taskJson = JSON.stringify(task);
    const oneTime = JSON.stringify({
      ...task,
      trigger: { kind: "one-time", at: nextRunAt },
      lastRunAt: null,
    });
    const unsupported = [
      { kind: "calendar", calendarId: "team" },
      { kind: "cron", expression: "* * * * *" },
      { kind: "email", query: "is:unread" },
      { kind: "github", owner: "team", repository: "reports", event: "push" },
    ].map((trigger) => ({
      taskId: `task-${trigger.kind}`,
      runId: `run-${trigger.kind}`,
      definition: JSON.stringify({ ...task, trigger }),
    }));
    yield* sql`
      INSERT INTO scheduled_tasks (task_id, revision, data_json, deleted, updated_at)
      VALUES ('task-weekly', 7, ${taskJson}, 0, ${createdAt}),
             ('task-once', 1, ${oneTime}, 0, ${createdAt}),
             ('task-deleted', 2, ${taskJson}, 1, ${createdAt})
    `;
    yield* sql`
      INSERT INTO scheduled_task_runs (
        run_id, task_id, status, data_json, scheduled_for, created_at, completed_at
      ) VALUES ('run-1', 'task-weekly', 'succeeded', '{}', ${createdAt}, ${createdAt}, ${createdAt})
    `;

    for (const { taskId, runId, definition } of unsupported) {
      yield* sql`
        INSERT INTO scheduled_tasks (task_id, revision, data_json, deleted, updated_at)
        VALUES (${taskId}, 3, ${definition}, 0, ${createdAt})
      `;
      yield* sql`
        INSERT INTO scheduled_task_runs (
          run_id, task_id, status, data_json, scheduled_for, created_at, completed_at
        ) VALUES (${runId}, ${taskId}, 'failed', '{"error":"original failure"}',
          ${createdAt}, ${createdAt}, ${createdAt})
      `;
    }

    yield* runMigrations();
    const active = yield* sql`
      SELECT task_id, enabled, schedule_json, runtime_mode, next_run_at, last_run_status, run_count
      FROM scheduled_tasks ORDER BY task_id
    `;
    assert.deepEqual(active, [
      {
        task_id: "task-once",
        enabled: 1,
        schedule_json: JSON.stringify({ type: "once", runAt: nextRunAt }),
        runtime_mode: "approval-required",
        next_run_at: nextRunAt,
        last_run_status: "never",
        run_count: 0,
      },
      {
        task_id: "task-weekly",
        enabled: 1,
        schedule_json: '{"type":"fixed_time","timeOfDay":"09:30","weekdays":[5]}',
        runtime_mode: "approval-required",
        next_run_at: nextRunAt,
        last_run_status: "succeeded",
        run_count: 1,
      },
    ]);
    const archived = yield* sql`
      SELECT task_id, revision, data_json, deleted FROM kairo_legacy_scheduled_tasks ORDER BY task_id
    `;
    assert.deepEqual(
      archived,
      [
        ...unsupported.map(({ taskId, definition }) => ({
          task_id: taskId,
          revision: 3,
          data_json: definition,
          deleted: 0,
        })),
        { task_id: "task-deleted", revision: 2, data_json: taskJson, deleted: 1 },
        { task_id: "task-once", revision: 1, data_json: oneTime, deleted: 0 },
        { task_id: "task-weekly", revision: 7, data_json: taskJson, deleted: 0 },
      ].sort((left, right) => left.task_id.localeCompare(right.task_id)),
    );
    assert.deepEqual(
      yield* sql`
        SELECT run_id, task_id, status, data_json
        FROM kairo_legacy_scheduled_task_runs ORDER BY run_id
      `,
      [
        { run_id: "run-1", task_id: "task-weekly", status: "succeeded", data_json: "{}" },
        ...unsupported.map(({ runId, taskId }) => ({
          run_id: runId,
          task_id: taskId,
          status: "failed",
          data_json: '{"error":"original failure"}',
        })),
      ],
    );
    assert.deepEqual(yield* runMigrations(), []);
  }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeSqliteClient.layer({ filename: ":memory:" }), NodeServices.layer),
    ),
  ),
);
