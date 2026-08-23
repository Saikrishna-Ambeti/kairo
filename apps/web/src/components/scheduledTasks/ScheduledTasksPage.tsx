import { useAtomValue } from "@effect/atom-react";
import {
  CommandId,
  EnvironmentId,
  ScheduledTaskId,
  type ModelSelection,
  type OrchestrationProjectShell,
  type ScheduledTaskCommand,
  type ScheduledTaskPermissionGrant,
  type ScheduledTaskRoutine,
  type ScheduledTaskTrigger,
  type ServerProvider,
} from "@kairo/contracts";
import { Link } from "@tanstack/react-router";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleAlertIcon,
  Clock3Icon,
  CopyIcon,
  GraduationCapIcon,
  InboxIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { isElectron } from "../../env";
import { randomUUID } from "../../lib/utils";
import { STUDENT_TASK_TEMPLATES, type StudentTaskTemplate } from "../../scheduledTasks";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { scheduledTaskEnvironment } from "../../state/scheduledTasks";
import { primaryServerProvidersAtom } from "../../state/server";
import { environmentShell } from "../../state/shell";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { Textarea } from "../ui/textarea";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";

type TriggerKind = ScheduledTaskTrigger["kind"];

interface RoutineDraft {
  readonly title: string;
  readonly prompt: string;
  readonly projectId: string;
  readonly triggerKind: TriggerKind;
  readonly time: string;
  readonly dayOfWeek: string;
  readonly oneTimeAt: string;
  readonly cron: string;
  readonly externalFilter: string;
  readonly timezone: string;
  readonly missedRuns: "skip" | "catch-up-once" | "catch-up-all";
  readonly overlap: "skip" | "queue";
}

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const EMPTY_DRAFT: RoutineDraft = {
  title: "",
  prompt: "",
  projectId: "",
  triggerKind: "daily",
  time: "19:00",
  dayOfWeek: "0",
  oneTimeAt: "",
  cron: "0 19 * * 1-5",
  externalFilter: "",
  timezone: localTimeZone,
  missedRuns: "skip",
  overlap: "skip",
};

const TRIGGER_LABELS: Readonly<Record<TriggerKind, string>> = {
  manual: "Manual",
  "one-time": "One time",
  hourly: "Hourly",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  cron: "Cron",
  webhook: "Webhook",
  calendar: "Calendar event",
  email: "Email",
  github: "GitHub event",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function commandMetadata() {
  return { commandId: CommandId.make(randomUUID()), createdAt: new Date().toISOString() };
}

function modelSelectionForProject(
  project: OrchestrationProjectShell | undefined,
  providers: ReadonlyArray<ServerProvider>,
): ModelSelection | null {
  if (project?.defaultModelSelection) return project.defaultModelSelection;
  const provider = providers.find((candidate) => candidate.enabled && candidate.installed);
  const model = provider?.models.find((candidate) => candidate.isDefault) ?? provider?.models[0];
  return provider && model ? { instanceId: provider.instanceId, model: model.slug } : null;
}

function triggerFromDraft(draft: RoutineDraft): ScheduledTaskTrigger | null {
  switch (draft.triggerKind) {
    case "manual":
      return { kind: "manual" };
    case "one-time":
      return Number.isFinite(Date.parse(draft.oneTimeAt))
        ? { kind: "one-time", at: new Date(draft.oneTimeAt).toISOString() }
        : null;
    case "hourly":
      return { kind: "hourly", minute: Number(draft.time.split(":")[1] ?? 0) };
    case "daily":
    case "weekdays":
      return { kind: draft.triggerKind, time: draft.time };
    case "weekly":
      return { kind: "weekly", dayOfWeek: Number(draft.dayOfWeek), time: draft.time };
    case "cron":
      return { kind: "cron", expression: draft.cron };
    case "webhook":
      return { kind: "webhook", hookId: draft.externalFilter || randomUUID() };
    case "calendar":
      return { kind: "calendar", calendarId: draft.externalFilter || "primary" };
    case "email":
      return { kind: "email", query: draft.externalFilter || "is:unread" };
    case "github": {
      const [owner = "owner", repository = "repository"] = draft.externalFilter.split("/");
      return { kind: "github", owner, repository, event: "pull_request" };
    }
  }
}

function draftFromTask(task: ScheduledTaskRoutine): RoutineDraft {
  const trigger = task.trigger;
  return {
    title: task.title,
    prompt: task.prompt,
    projectId: task.projectId,
    triggerKind: trigger.kind,
    time:
      trigger.kind === "daily" || trigger.kind === "weekdays" || trigger.kind === "weekly"
        ? trigger.time
        : trigger.kind === "hourly"
          ? `00:${String(trigger.minute).padStart(2, "0")}`
          : "19:00",
    dayOfWeek: trigger.kind === "weekly" ? String(trigger.dayOfWeek) : "0",
    oneTimeAt: trigger.kind === "one-time" ? new Date(trigger.at).toISOString().slice(0, 16) : "",
    cron: trigger.kind === "cron" ? trigger.expression : "0 19 * * 1-5",
    externalFilter:
      trigger.kind === "webhook"
        ? trigger.hookId
        : trigger.kind === "calendar"
          ? trigger.calendarId
          : trigger.kind === "email"
            ? trigger.query
            : trigger.kind === "github"
              ? `${trigger.owner}/${trigger.repository}`
              : "",
    timezone: task.timezone,
    missedRuns: task.executionPolicy.missedRuns,
    overlap: task.executionPolicy.overlap,
  };
}

function templateDraft(template: StudentTaskTemplate, projectId: string): RoutineDraft {
  const friday = template.id === "study-reset";
  const sunday = template.id === "weekly-revision";
  return {
    ...EMPTY_DRAFT,
    title: template.title,
    prompt: template.prompt,
    projectId,
    triggerKind: sunday ? "weekly" : "weekdays",
    dayOfWeek: sunday ? "0" : friday ? "5" : "1",
    time: sunday ? "17:00" : friday ? "20:00" : template.id === "lecture-notes" ? "18:00" : "19:00",
  };
}

function scheduleLabel(task: ScheduledTaskRoutine): string {
  const trigger = task.trigger;
  switch (trigger.kind) {
    case "manual":
      return "Manual only";
    case "one-time":
      return new Date(trigger.at).toLocaleString();
    case "hourly":
      return `Hourly at :${String(trigger.minute).padStart(2, "0")}`;
    case "daily":
      return `Daily at ${trigger.time}`;
    case "weekdays":
      return `Weekdays at ${trigger.time}`;
    case "weekly":
      return `${WEEKDAYS[trigger.dayOfWeek]} at ${trigger.time}`;
    case "cron":
      return `Cron ${trigger.expression}`;
    case "webhook":
      return `Webhook ${trigger.hookId}`;
    case "calendar":
      return `Calendar ${trigger.calendarId}`;
    case "email":
      return `Email ${trigger.query}`;
    case "github":
      return `GitHub ${trigger.owner}/${trigger.repository}`;
  }
}

export function ScheduledTasksPage() {
  const environmentId = usePrimaryEnvironmentId();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const shellState = useAtomValue(
    environmentShell.stateValueAtom(environmentId ?? EnvironmentId.make("scheduler-unavailable")),
  );
  const projects = shellState.snapshot._tag === "Some" ? shellState.snapshot.value.projects : [];
  const target = environmentId === null ? null : { environmentId, input: {} };
  const snapshotQuery = useEnvironmentQuery(
    target === null ? null : scheduledTaskEnvironment.snapshot(target),
  );
  const dispatch = useAtomCommand(scheduledTaskEnvironment.dispatch, { reportFailure: false });
  const tasks = snapshotQuery.data?.tasks ?? [];
  const runs = snapshotQuery.data?.runs ?? [];
  const [draft, setDraft] = useState<RoutineDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<ScheduledTaskRoutine | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft.projectId === "" && projects[0]) {
      setDraft((current) => ({ ...current, projectId: projects[0]?.id ?? "" }));
    }
  }, [draft.projectId, projects]);

  useEffect(() => {
    const refresh = () => snapshotQuery.refresh();
    const interval = window.setInterval(refresh, 3_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [snapshotQuery.refresh]);

  const pendingReviewCount = useMemo(
    () => runs.filter((run) => run.completedAt !== null && run.reviewedAt === null).length,
    [runs],
  );

  const mutate = async (command: ScheduledTaskCommand, success: string) => {
    if (environmentId === null) return false;
    const result = await dispatch({ environmentId, input: command });
    if (result._tag === "Failure") {
      setStatus("Routine changed elsewhere or could not be saved. Reloaded latest version.");
      snapshotQuery.refresh();
      return false;
    }
    setStatus(success);
    snapshotQuery.refresh();
    return true;
  };

  const openCreate = (
    nextDraft: RoutineDraft = { ...EMPTY_DRAFT, projectId: projects[0]?.id ?? "" },
  ) => {
    setEditing(null);
    setDraft(nextDraft);
    setFormOpen(true);
  };

  const saveDraft = async () => {
    if (environmentId === null || draft.title.trim() === "" || draft.prompt.trim() === "") return;
    const project = projects.find((candidate) => candidate.id === draft.projectId);
    const modelSelection = modelSelectionForProject(project, providers);
    if (!project || modelSelection === null) {
      setStatus("Choose a project with an available provider before saving.");
      return;
    }
    setSaving(true);
    const trigger = triggerFromDraft(draft);
    if (trigger === null) {
      setSaving(false);
      setStatus("Choose a valid date and time before saving.");
      return;
    }
    const metadata = commandMetadata();
    const command: ScheduledTaskCommand = editing
      ? {
          type: "scheduled-task.update",
          ...metadata,
          taskId: editing.id,
          expectedRevision: editing.revision,
          patch: {
            title: draft.title,
            prompt: draft.prompt,
            trigger,
            timezone: draft.timezone,
            executionPolicy: {
              missedRuns: draft.missedRuns,
              overlap: draft.overlap,
              isolatedWorktree: false,
            },
            modelSelection,
          },
        }
      : {
          type: "scheduled-task.create",
          ...metadata,
          task: {
            id: ScheduledTaskId.make(randomUUID()),
            projectId: project.id,
            title: draft.title,
            prompt: draft.prompt,
            enabled: true,
            trigger,
            timezone: draft.timezone,
            executionPolicy: {
              missedRuns: draft.missedRuns,
              overlap: draft.overlap,
              isolatedWorktree: false,
            },
            permissions: [],
            modelSelection,
            runtimeMode: "approval-required",
            interactionMode: "default",
          },
        };
    const saved = await mutate(command, editing ? "Routine updated." : "Routine scheduled.");
    setSaving(false);
    if (saved) {
      setFormOpen(false);
      setEditing(null);
    }
  };

  const taskCommand = (
    task: ScheduledTaskRoutine,
    command: "pause" | "resume" | "run-now" | "delete",
  ) =>
    mutate(
      {
        type: `scheduled-task.${command}` as
          | "scheduled-task.pause"
          | "scheduled-task.resume"
          | "scheduled-task.run-now"
          | "scheduled-task.delete",
        ...commandMetadata(),
        taskId: task.id,
        expectedRevision: task.revision,
      },
      command === "run-now"
        ? "Run queued."
        : `Routine ${command === "delete" ? "deleted" : `${command}d`}.`,
    );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border/60">
          <div className="flex w-full items-center gap-3">
            <WorkspaceBreadcrumb ariaLabel="Scheduled tasks breadcrumb">
              <WorkspaceBreadcrumbItem current>
                <h1>Scheduled tasks</h1>
              </WorkspaceBreadcrumbItem>
            </WorkspaceBreadcrumb>
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">
              {tasks.filter((task) => task.enabled).length} active
            </span>
            <Button size="sm" onClick={() => openCreate()}>
              <PlusIcon /> New routine
            </Button>
          </div>
        </WorkspacePageHeader>

        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide" className="gap-8 py-8">
            <section className="grid gap-5 border-b border-border/60 pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="max-w-2xl">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <GraduationCapIcon className="size-5" aria-hidden />
                </div>
                <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Schoolwork that starts on time.
                </h2>
                <p className="mt-3 max-w-[68ch] text-sm leading-6 text-muted-foreground sm:text-base">
                  Every run opens a normal Kairo chat. Review work, answer permission requests in
                  the composer, and continue the session from any device.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <InboxIcon className="size-4" aria-hidden />
                <span>
                  <strong className="font-medium text-foreground">{pendingReviewCount}</strong>{" "}
                  awaiting review
                </span>
              </div>
            </section>

            {status ? (
              <div
                role="status"
                className="rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm"
              >
                {status}
              </div>
            ) : null}

            {formOpen ? (
              <RoutineForm
                draft={draft}
                editing={editing !== null}
                projects={projects}
                saving={saving}
                onChange={setDraft}
                onCancel={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
                onSave={() => void saveDraft()}
              />
            ) : (
              <section aria-labelledby="student-starters-heading">
                <div className="mb-3">
                  <h2 id="student-starters-heading" className="text-base font-semibold">
                    Student starters
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start ready, then adjust timing and permissions.
                  </p>
                </div>
                <div className="grid overflow-hidden rounded-xl border border-border/70 sm:grid-cols-2 lg:grid-cols-4">
                  {STUDENT_TASK_TEMPLATES.map((template, index) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => openCreate(templateDraft(template, projects[0]?.id ?? ""))}
                      className={`min-h-40 cursor-pointer p-4 text-left outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${index > 0 ? "border-t border-border/70 sm:border-t-0" : ""} ${index % 2 === 1 ? "sm:border-l sm:border-border/70" : ""}`}
                    >
                      <span className="text-sm font-medium">{template.title}</span>
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {template.description}
                      </span>
                      <span className="mt-6 flex items-center gap-1.5 text-xs font-medium">
                        <PlusIcon className="size-3" /> Schedule
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="routines-heading">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h2 id="routines-heading" className="text-base font-semibold">
                    Your routines
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Server-backed. Revision conflicts reload instead of overwriting newer changes.
                  </p>
                </div>
                <Button
                  variant="ghost-muted"
                  size="xs"
                  onClick={snapshotQuery.refresh}
                  disabled={snapshotQuery.isPending}
                >
                  <RefreshCwIcon
                    className={
                      snapshotQuery.isPending ? "animate-spin motion-reduce:animate-none" : ""
                    }
                  />{" "}
                  Refresh
                </Button>
              </div>
              {snapshotQuery.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {snapshotQuery.error}
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
                  <CalendarClockIcon className="size-6 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 text-sm font-medium">No routines yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a starter or build your own.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  {tasks.map((task, index) => (
                    <RoutineRow
                      key={task.id}
                      task={task}
                      separated={index > 0}
                      onEdit={() => {
                        setEditing(task);
                        setDraft(draftFromTask(task));
                        setFormOpen(true);
                      }}
                      onCommand={(command) => {
                        if (
                          command === "delete" &&
                          !window.confirm(
                            `Delete “${task.title}”? Its run receipts stay in history.`,
                          )
                        ) {
                          return;
                        }
                        void taskCommand(task, command);
                      }}
                      onDuplicate={() =>
                        void mutate(
                          {
                            type: "scheduled-task.duplicate",
                            ...commandMetadata(),
                            taskId: task.id,
                            expectedRevision: task.revision,
                            duplicateId: ScheduledTaskId.make(randomUUID()),
                          },
                          "Routine duplicated and paused.",
                        )
                      }
                      onRevoke={(permission) =>
                        void mutate(
                          {
                            type: "scheduled-task.permission.revoke",
                            ...commandMetadata(),
                            taskId: task.id,
                            expectedRevision: task.revision,
                            permissionId: permission.id,
                          },
                          "Permission revoked.",
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section
              aria-labelledby="review-inbox-heading"
              className="border-t border-border/60 pt-7"
            >
              <div className="mb-3">
                <h2 id="review-inbox-heading" className="text-base font-semibold">
                  Review inbox
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent runs and skipped work. Open chat to inspect results or answer blocked
                  permissions.
                </p>
              </div>
              {runs.length === 0 ? (
                <p className="rounded-xl bg-muted/45 px-4 py-6 text-center text-sm text-muted-foreground">
                  Completed runs appear here.
                </p>
              ) : (
                <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {runs.slice(0, 20).map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                    >
                      {run.status === "succeeded" ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : run.status === "failed" || run.status === "skipped" ? (
                        <CircleAlertIcon className="size-4 text-amber-600" />
                      ) : (
                        <Clock3Icon className="size-4 text-blue-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{run.taskTitle}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {run.status} · {new Date(run.scheduledFor).toLocaleString()}
                          {run.reason ? ` · ${run.reason}` : ""}
                        </p>
                      </div>
                      {run.threadId && environmentId ? (
                        <Button
                          variant="outline"
                          size="xs"
                          render={
                            <Link
                              to="/$environmentId/$threadId"
                              params={{ environmentId, threadId: run.threadId }}
                            />
                          }
                        >
                          Open chat
                        </Button>
                      ) : null}
                      {run.completedAt && !run.reviewedAt ? (
                        <Button
                          variant="ghost-muted"
                          size="xs"
                          onClick={() =>
                            void mutate(
                              {
                                type: "scheduled-task.run.review",
                                ...commandMetadata(),
                                runId: run.id,
                              },
                              "Run marked reviewed.",
                            )
                          }
                        >
                          Mark reviewed
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}

function RoutineForm({
  draft,
  editing,
  projects,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  readonly draft: RoutineDraft;
  readonly editing: boolean;
  readonly projects: ReadonlyArray<OrchestrationProjectShell>;
  readonly saving: boolean;
  readonly onChange: (draft: RoutineDraft) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}) {
  const change = <K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const needsTime = ["hourly", "daily", "weekdays", "weekly"].includes(draft.triggerKind);
  const needsFilter = ["webhook", "calendar", "email", "github"].includes(draft.triggerKind);
  return (
    <section
      aria-labelledby="routine-form-heading"
      className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="routine-form-heading" className="text-base font-semibold">
            {editing ? "Edit routine" : "New routine"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs use approval-required mode. Extra tool access stays visible in chat composer.
          </p>
        </div>
        <Button variant="ghost-muted" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Name
          <Input
            value={draft.title}
            onChange={(event) => change("title", event.target.value)}
            placeholder="Evening assignment check"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Project
          <Select
            value={draft.projectId}
            onValueChange={(value) => value !== null && change("projectId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium lg:col-span-2">
          Instructions
          <Textarea
            value={draft.prompt}
            onChange={(event) => change("prompt", event.target.value)}
            className="min-h-28"
            placeholder="Review my assignments and prepare the next three actions."
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Trigger
          <Select
            value={draft.triggerKind}
            onValueChange={(value) => change("triggerKind", value as TriggerKind)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Timezone
          <Input
            value={draft.timezone}
            onChange={(event) => change("timezone", event.target.value)}
          />
        </label>
        {needsTime ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Time
            <Input
              type="time"
              value={draft.time}
              onChange={(event) => change("time", event.target.value)}
            />
          </label>
        ) : null}
        {draft.triggerKind === "weekly" ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Day
            <Select
              value={draft.dayOfWeek}
              onValueChange={(value) => value !== null && change("dayOfWeek", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day, index) => (
                  <SelectItem key={day} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
        {draft.triggerKind === "one-time" ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Run at
            <Input
              type="datetime-local"
              value={draft.oneTimeAt}
              onChange={(event) => change("oneTimeAt", event.target.value)}
            />
          </label>
        ) : null}
        {draft.triggerKind === "cron" ? (
          <label className="grid gap-1.5 text-sm font-medium lg:col-span-2">
            Cron expression
            <Input
              value={draft.cron}
              onChange={(event) => change("cron", event.target.value)}
              placeholder="0 19 * * 1-5"
            />
          </label>
        ) : null}
        {needsFilter ? (
          <label className="grid gap-1.5 text-sm font-medium lg:col-span-2">
            {draft.triggerKind === "github"
              ? "Repository"
              : draft.triggerKind === "email"
                ? "Email query"
                : draft.triggerKind === "calendar"
                  ? "Calendar ID"
                  : "Webhook ID"}
            <Input
              value={draft.externalFilter}
              onChange={(event) => change("externalFilter", event.target.value)}
              placeholder={draft.triggerKind === "github" ? "owner/repository" : undefined}
            />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium">
          Missed runs
          <Select
            value={draft.missedRuns}
            onValueChange={(value) => change("missedRuns", value as RoutineDraft["missedRuns"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip</SelectItem>
              <SelectItem value="catch-up-once">Catch up once</SelectItem>
              <SelectItem value="catch-up-all">Catch up all</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          When already running
          <Select
            value={draft.overlap}
            onValueChange={(value) => change("overlap", value as RoutineDraft["overlap"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip new run</SelectItem>
              <SelectItem value="queue">Queue new run</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || !draft.title.trim() || !draft.prompt.trim() || !draft.projectId}
        >
          {saving ? "Saving..." : editing ? "Save changes" : "Schedule routine"}
        </Button>
      </div>
    </section>
  );
}

function RoutineRow({
  task,
  separated,
  onEdit,
  onCommand,
  onDuplicate,
  onRevoke,
}: {
  readonly task: ScheduledTaskRoutine;
  readonly separated: boolean;
  readonly onEdit: () => void;
  readonly onCommand: (command: "pause" | "resume" | "run-now" | "delete") => void;
  readonly onDuplicate: () => void;
  readonly onRevoke: (permission: ScheduledTaskPermissionGrant) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={separated ? "border-t border-border/70" : undefined}>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{task.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${task.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
            >
              {task.enabled ? "Active" : "Paused"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-muted-foreground">
            {task.prompt}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock3Icon className="size-3" /> {scheduleLabel(task)}
            </span>
            <span>{task.timezone}</span>
            {task.nextRunAt ? <span>Next {new Date(task.nextRunAt).toLocaleString()}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button variant="outline" size="xs" onClick={() => onCommand("run-now")}>
            <PlayIcon /> Run now
          </Button>
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={`Edit ${task.title}`}
            onClick={onEdit}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={`Duplicate ${task.title}`}
            onClick={onDuplicate}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={task.enabled ? `Pause ${task.title}` : `Resume ${task.title}`}
            onClick={() => onCommand(task.enabled ? "pause" : "resume")}
          >
            {task.enabled ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={`Delete ${task.title}`}
            onClick={() => onCommand("delete")}
          >
            <Trash2Icon />
          </Button>
          <Button
            variant="ghost-muted"
            size="icon-sm"
            aria-label={`Show permissions for ${task.title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDownIcon
              className={
                expanded
                  ? "rotate-180 transition-transform motion-reduce:transition-none"
                  : "transition-transform motion-reduce:transition-none"
              }
            />
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-border/60 bg-muted/25 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheckIcon className="size-4" /> Routine permissions
          </div>
          {task.permissions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No persistent grants. Protected actions ask in run chat composer.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {task.permissions.map((permission) => (
                <span
                  key={permission.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                >
                  <span>
                    {permission.capability} · {permission.scope}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRevoke(permission)}
                  >
                    Revoke
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
