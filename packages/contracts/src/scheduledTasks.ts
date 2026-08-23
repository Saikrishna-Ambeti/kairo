import * as Schema from "effect/Schema";

import {
  CommandId,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TrimmedString,
} from "./baseSchemas.ts";
import { ModelSelection, ProviderInteractionMode, RuntimeMode } from "./orchestration.ts";

export const ScheduledTaskId = TrimmedNonEmptyString.pipe(Schema.brand("ScheduledTaskId"));
export type ScheduledTaskId = typeof ScheduledTaskId.Type;

export const ScheduledTaskRunId = TrimmedNonEmptyString.pipe(Schema.brand("ScheduledTaskRunId"));
export type ScheduledTaskRunId = typeof ScheduledTaskRunId.Type;

export const ScheduledTaskTriggerKind = Schema.Literals([
  "manual",
  "one-time",
  "hourly",
  "daily",
  "weekdays",
  "weekly",
  "cron",
  "webhook",
  "calendar",
  "email",
  "github",
]);
export type ScheduledTaskTriggerKind = typeof ScheduledTaskTriggerKind.Type;

const WallClockTime = Schema.String.check(
  Schema.makeFilter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || "Expected HH:mm."),
);

export const ScheduledTaskTrigger = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("manual") }),
  Schema.Struct({ kind: Schema.Literal("one-time"), at: IsoDateTime }),
  Schema.Struct({
    kind: Schema.Literal("hourly"),
    minute: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })),
  }),
  Schema.Struct({ kind: Schema.Literal("daily"), time: WallClockTime }),
  Schema.Struct({ kind: Schema.Literal("weekdays"), time: WallClockTime }),
  Schema.Struct({
    kind: Schema.Literal("weekly"),
    dayOfWeek: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 6 })),
    time: WallClockTime,
  }),
  Schema.Struct({ kind: Schema.Literal("cron"), expression: TrimmedNonEmptyString }),
  Schema.Struct({ kind: Schema.Literal("webhook"), hookId: TrimmedNonEmptyString }),
  Schema.Struct({
    kind: Schema.Literal("calendar"),
    calendarId: TrimmedNonEmptyString,
    query: Schema.optional(TrimmedString),
  }),
  Schema.Struct({ kind: Schema.Literal("email"), query: TrimmedNonEmptyString }),
  Schema.Struct({
    kind: Schema.Literal("github"),
    owner: TrimmedNonEmptyString,
    repository: TrimmedNonEmptyString,
    event: Schema.Literals([
      "issues",
      "issue_comment",
      "pull_request",
      "pull_request_review",
      "push",
      "release",
      "workflow_run",
    ]),
  }),
]);
export type ScheduledTaskTrigger = typeof ScheduledTaskTrigger.Type;

export const ScheduledTaskExecutionPolicy = Schema.Struct({
  missedRuns: Schema.Literals(["skip", "catch-up-once", "catch-up-all"]),
  overlap: Schema.Literals(["skip", "queue"]),
  isolatedWorktree: Schema.Boolean,
});
export type ScheduledTaskExecutionPolicy = typeof ScheduledTaskExecutionPolicy.Type;

export const ScheduledTaskPermissionCapability = Schema.Literals([
  "read-files",
  "write-files",
  "run-commands",
  "network",
  "use-connectors",
]);
export type ScheduledTaskPermissionCapability = typeof ScheduledTaskPermissionCapability.Type;

export const ScheduledTaskPermissionGrant = Schema.Struct({
  id: TrimmedNonEmptyString,
  capability: ScheduledTaskPermissionCapability,
  scope: TrimmedNonEmptyString,
  grantedAt: IsoDateTime,
});
export type ScheduledTaskPermissionGrant = typeof ScheduledTaskPermissionGrant.Type;

export const ScheduledTaskRoutine = Schema.Struct({
  id: ScheduledTaskId,
  revision: NonNegativeInt,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  prompt: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
  trigger: ScheduledTaskTrigger,
  timezone: TrimmedNonEmptyString,
  executionPolicy: ScheduledTaskExecutionPolicy,
  permissions: Schema.Array(ScheduledTaskPermissionGrant),
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  nextRunAt: Schema.NullOr(IsoDateTime),
  lastRunAt: Schema.NullOr(IsoDateTime),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ScheduledTaskRoutine = typeof ScheduledTaskRoutine.Type;

export const ScheduledTaskRunStatus = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);
export type ScheduledTaskRunStatus = typeof ScheduledTaskRunStatus.Type;

export const ScheduledTaskRunReceipt = Schema.Struct({
  id: ScheduledTaskRunId,
  taskId: ScheduledTaskId,
  taskTitle: TrimmedNonEmptyString,
  status: ScheduledTaskRunStatus,
  triggerKind: ScheduledTaskTriggerKind,
  scheduledFor: IsoDateTime,
  startedAt: Schema.NullOr(IsoDateTime),
  completedAt: Schema.NullOr(IsoDateTime),
  threadId: Schema.NullOr(ThreadId),
  reason: Schema.NullOr(TrimmedNonEmptyString),
  reviewedAt: Schema.NullOr(IsoDateTime),
});
export type ScheduledTaskRunReceipt = typeof ScheduledTaskRunReceipt.Type;

export const ScheduledTaskSnapshot = Schema.Struct({
  revision: NonNegativeInt,
  tasks: Schema.Array(ScheduledTaskRoutine),
  runs: Schema.Array(ScheduledTaskRunReceipt),
});
export type ScheduledTaskSnapshot = typeof ScheduledTaskSnapshot.Type;

const ScheduledTaskCreateCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.create"),
  commandId: CommandId,
  task: Schema.Struct({
    id: ScheduledTaskId,
    projectId: ProjectId,
    title: TrimmedNonEmptyString,
    prompt: TrimmedNonEmptyString,
    enabled: Schema.Boolean,
    trigger: ScheduledTaskTrigger,
    timezone: TrimmedNonEmptyString,
    executionPolicy: ScheduledTaskExecutionPolicy,
    permissions: Schema.Array(ScheduledTaskPermissionGrant),
    modelSelection: ModelSelection,
    runtimeMode: RuntimeMode,
    interactionMode: ProviderInteractionMode,
  }),
  createdAt: IsoDateTime,
});

const ScheduledTaskUpdateCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.update"),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  patch: Schema.Struct({
    title: Schema.optional(TrimmedNonEmptyString),
    prompt: Schema.optional(TrimmedNonEmptyString),
    trigger: Schema.optional(ScheduledTaskTrigger),
    timezone: Schema.optional(TrimmedNonEmptyString),
    executionPolicy: Schema.optional(ScheduledTaskExecutionPolicy),
    permissions: Schema.optional(Schema.Array(ScheduledTaskPermissionGrant)),
    modelSelection: Schema.optional(ModelSelection),
    runtimeMode: Schema.optional(RuntimeMode),
    interactionMode: Schema.optional(ProviderInteractionMode),
  }),
  createdAt: IsoDateTime,
});

const ScheduledTaskStateCommand = Schema.Struct({
  type: Schema.Literals(["scheduled-task.pause", "scheduled-task.resume"]),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  createdAt: IsoDateTime,
});

const ScheduledTaskDeleteCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.delete"),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  createdAt: IsoDateTime,
});

const ScheduledTaskDuplicateCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.duplicate"),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  duplicateId: ScheduledTaskId,
  createdAt: IsoDateTime,
});

const ScheduledTaskRunNowCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.run-now"),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  createdAt: IsoDateTime,
});

const ScheduledTaskPermissionRevokeCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.permission.revoke"),
  commandId: CommandId,
  taskId: ScheduledTaskId,
  expectedRevision: NonNegativeInt,
  permissionId: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
});

const ScheduledTaskRunReviewCommand = Schema.Struct({
  type: Schema.Literal("scheduled-task.run.review"),
  commandId: CommandId,
  runId: ScheduledTaskRunId,
  createdAt: IsoDateTime,
});

export const ScheduledTaskCommand = Schema.Union([
  ScheduledTaskCreateCommand,
  ScheduledTaskUpdateCommand,
  ScheduledTaskStateCommand,
  ScheduledTaskDeleteCommand,
  ScheduledTaskDuplicateCommand,
  ScheduledTaskRunNowCommand,
  ScheduledTaskPermissionRevokeCommand,
  ScheduledTaskRunReviewCommand,
]);
export type ScheduledTaskCommand = typeof ScheduledTaskCommand.Type;

export const ScheduledTaskEvent = Schema.Struct({
  sequence: NonNegativeInt,
  taskId: Schema.NullOr(ScheduledTaskId),
  eventType: Schema.Literals([
    "created",
    "updated",
    "paused",
    "resumed",
    "deleted",
    "duplicated",
    "permission-revoked",
    "run-queued",
    "run-started",
    "run-completed",
    "run-skipped",
    "run-reviewed",
  ]),
  commandId: Schema.NullOr(CommandId),
  occurredAt: IsoDateTime,
  payload: Schema.Unknown,
});
export type ScheduledTaskEvent = typeof ScheduledTaskEvent.Type;

export const ScheduledTaskExternalTriggerInput = Schema.Struct({
  taskId: ScheduledTaskId,
  source: Schema.Literals(["webhook", "calendar", "email", "github"]),
  eventId: TrimmedNonEmptyString,
  occurredAt: IsoDateTime,
  payload: Schema.Unknown,
});
export type ScheduledTaskExternalTriggerInput = typeof ScheduledTaskExternalTriggerInput.Type;

export const ScheduledTaskDispatchResult = Schema.Struct({
  revision: NonNegativeInt,
  task: Schema.optional(ScheduledTaskRoutine),
  run: Schema.optional(ScheduledTaskRunReceipt),
});
export type ScheduledTaskDispatchResult = typeof ScheduledTaskDispatchResult.Type;

export class ScheduledTaskError extends Schema.TaggedErrorClass<ScheduledTaskError>()(
  "ScheduledTaskError",
  {
    code: Schema.Literals([
      "NOT_FOUND",
      "CONFLICT",
      "INVALID_SCHEDULE",
      "INVALID_TIMEZONE",
      "TRIGGER_MISMATCH",
      "PROJECT_UNAVAILABLE",
      "PROVIDER_UNAVAILABLE",
      "INTERNAL",
    ]),
    message: TrimmedNonEmptyString,
    currentRevision: Schema.optional(NonNegativeInt),
  },
) {}

export const ScheduledTaskConversationAction = Schema.Struct({
  action: Schema.Literals(["pause", "resume", "run", "delete"]),
  routineTitle: TrimmedNonEmptyString,
});
export type ScheduledTaskConversationAction = typeof ScheduledTaskConversationAction.Type;

export const ScheduledTaskComposerResult = Schema.Struct({
  handled: Schema.Boolean,
  message: TrimmedNonEmptyString,
  taskId: Schema.optional(ScheduledTaskId),
});
export type ScheduledTaskComposerResult = typeof ScheduledTaskComposerResult.Type;
