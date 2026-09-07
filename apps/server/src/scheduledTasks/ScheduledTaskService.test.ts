import {
  CommandId,
  ProjectId,
  ProviderInstanceId,
  ScheduledTaskId,
  ScheduledTaskRunId,
  ScheduledTaskRunReceipt,
  type OrchestrationCommand,
} from "@kairo/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { ScheduledTaskService, layer } from "./ScheduledTaskService.ts";

const encodeRun = Schema.encodeSync(Schema.fromJsonString(ScheduledTaskRunReceipt));

const projectionLayer = Layer.succeed(ProjectionSnapshotQuery, {
  getCommandReadModel: () => Effect.die("unused"),
  getSnapshot: () => Effect.die("unused"),
  getShellSnapshot: () => Effect.die("unused"),
  getArchivedShellSnapshot: () => Effect.die("unused"),
  searchThreads: () => Effect.die("unused"),
  getSnapshotSequence: () => Effect.die("unused"),
  getCounts: () => Effect.die("unused"),
  getActiveProjectByWorkspaceRoot: () => Effect.die("unused"),
  getProjectShellById: () => Effect.die("unused"),
  getFirstActiveThreadIdByProjectId: () => Effect.die("unused"),
  getThreadCheckpointContext: () => Effect.die("unused"),
  getFullThreadDiffContext: () => Effect.die("unused"),
  getThreadShellById: () => Effect.succeed(Option.none()),
  getThreadDetailById: () => Effect.die("unused"),
  getThreadDetailSnapshot: () => Effect.die("unused"),
});

describe("ScheduledTaskService", () => {
  it.effect("creates a run thread before starting its first turn", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<OrchestrationCommand>>([]);
      const orchestrationLayer = Layer.succeed(OrchestrationEngineService, {
        dispatch: (command) =>
          Ref.update(commands, (current) => [...current, command]).pipe(Effect.as({ sequence: 1 })),
        readEvents: () => Stream.empty,
        streamDomainEvents: Stream.empty,
        latestSequence: Effect.succeed(0),
      });
      const testLayer = layer.pipe(
        Layer.provideMerge(SqlitePersistenceMemory),
        Layer.provideMerge(orchestrationLayer),
        Layer.provideMerge(projectionLayer),
      );

      yield* Effect.gen(function* () {
        const service = yield* ScheduledTaskService;
        const sql = yield* SqlClient.SqlClient;
        const taskId = ScheduledTaskId.make("task-1");
        const scheduledFor = "2026-08-27T14:30:00.000Z";

        yield* service.dispatch({
          type: "scheduled-task.create",
          commandId: CommandId.make("create-task"),
          task: {
            id: taskId,
            projectId: ProjectId.make("project-1"),
            title: "Assignment check-in",
            prompt: "Review current assignments.",
            enabled: true,
            trigger: { kind: "manual" },
            timezone: "UTC",
            executionPolicy: { missedRuns: "skip", overlap: "skip", isolatedWorktree: false },
            permissions: [],
            modelSelection: {
              instanceId: ProviderInstanceId.make("codex"),
              model: "gpt-5.6",
            },
            runtimeMode: "approval-required",
            interactionMode: "default",
          },
          createdAt: scheduledFor,
        });

        const queuedRun = {
          id: ScheduledTaskRunId.make("run-1"),
          taskId,
          taskTitle: "Assignment check-in",
          status: "queued" as const,
          triggerKind: "manual" as const,
          scheduledFor,
          startedAt: null,
          completedAt: null,
          threadId: null,
          reason: null,
          reviewedAt: null,
        };
        yield* sql`
          INSERT INTO scheduled_task_runs (
            run_id, task_id, status, data_json, scheduled_for, created_at, completed_at
          ) VALUES (
            ${queuedRun.id}, ${queuedRun.taskId}, ${queuedRun.status}, ${encodeRun(queuedRun)},
            ${queuedRun.scheduledFor}, ${queuedRun.scheduledFor}, ${queuedRun.completedAt}
          )
        `;

        yield* service.tick;

        const dispatched = yield* Ref.get(commands);
        assert.deepStrictEqual(
          dispatched.map((command) => command.type),
          ["thread.create", "thread.turn.start"],
        );
        const createThread = dispatched[0];
        const startTurn = dispatched[1];
        assert.strictEqual(createThread?.type, "thread.create");
        assert.strictEqual(startTurn?.type, "thread.turn.start");
        if (createThread?.type === "thread.create" && startTurn?.type === "thread.turn.start") {
          assert.strictEqual(startTurn.threadId, createThread.threadId);
          assert.isUndefined(startTurn.bootstrap);
        }
      }).pipe(Effect.provide(testLayer));
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
