import {
  BookOpenIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  Clock3Icon,
  GraduationCapIcon,
  HeartIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isElectron } from "../../env";
import {
  STUDENT_TASK_TEMPLATES,
  removeScheduledTask,
  taskFromTemplate,
  type StudentScheduledTask,
  type StudentTaskCategory,
} from "../../scheduledTasks";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { SidebarInset } from "../ui/sidebar";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";

const CATEGORY_DETAILS: Record<
  StudentTaskCategory,
  { readonly label: string; readonly className: string; readonly icon: typeof BookOpenIcon }
> = {
  assignments: {
    label: "Assignments",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: CalendarCheckIcon,
  },
  revision: {
    label: "Revision",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: BookOpenIcon,
  },
  classes: {
    label: "Classes",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    icon: GraduationCapIcon,
  },
  wellbeing: {
    label: "Wellbeing",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: HeartIcon,
  },
};

const STARTER_TASKS: readonly StudentScheduledTask[] = [];

const STUDENT_TASKS_STORAGE_KEY = "kairo:student-scheduled-tasks";

function readStoredTasks(): readonly StudentScheduledTask[] {
  try {
    const value = window.localStorage.getItem(STUDENT_TASKS_STORAGE_KEY);
    if (!value) return STARTER_TASKS;
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return STARTER_TASKS;
    const valid = parsed.every(
      (task) =>
        typeof task === "object" &&
        task !== null &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.prompt === "string" &&
        typeof task.schedule === "string" &&
        (task.category === "assignments" ||
          task.category === "revision" ||
          task.category === "classes" ||
          task.category === "wellbeing"),
    );
    return valid ? (parsed as readonly StudentScheduledTask[]) : STARTER_TASKS;
  } catch {
    return STARTER_TASKS;
  }
}

export function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<readonly StudentScheduledTask[]>(readStoredTasks);
  const [showTemplates, setShowTemplates] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const addTaskButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDENT_TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Private browsing and storage policies can reject writes. Keep the page usable in memory.
    }
  }, [tasks]);

  const addTemplate = (templateId: string) => {
    const template = STUDENT_TASK_TEMPLATES.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setTasks((current) => [...current, taskFromTemplate(template)]);
    setStatusMessage(`${template.title} added to your saved routines.`);
  };

  const closeTemplates = () => {
    setShowTemplates(false);
    window.requestAnimationFrame(() => addTaskButtonRef.current?.focus());
  };

  const removeTask = (task: StudentScheduledTask) => {
    setTasks((current) => removeScheduledTask(current, task.id));
    setStatusMessage(`${task.title} removed.`);
    window.requestAnimationFrame(() => addTaskButtonRef.current?.focus());
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border/60">
          <div className="flex w-full min-w-0 items-center gap-3">
            <WorkspaceBreadcrumb ariaLabel="Scheduled tasks breadcrumb">
              <WorkspaceBreadcrumbItem current>
                <h1>Scheduled tasks</h1>
              </WorkspaceBreadcrumbItem>
            </WorkspaceBreadcrumb>
            <div className="ms-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {tasks.length} saved
              </span>
              <Button
                ref={addTaskButtonRef}
                size="sm"
                onClick={() => setShowTemplates((open) => !open)}
              >
                <PlusIcon />
                Add routine
              </Button>
            </div>
          </div>
        </WorkspacePageHeader>

        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide" className="gap-8 pt-8">
            <section className="grid gap-6 border-b border-border/60 pb-8 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
              <div className="max-w-2xl">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  <GraduationCapIcon className="size-5" aria-hidden />
                </div>
                <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Keep schoolwork moving, even when your week gets busy.
                </h2>
                <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground sm:text-base">
                  Draft deadline checks, revision sessions, and lecture-note cleanup around your
                  timetable. These routines stay in this browser and do not run automatically yet.
                </p>
              </div>

              <div className="rounded-xl bg-blue-500/8 px-4 py-4 text-blue-950 dark:bg-blue-400/10 dark:text-blue-100">
                <span className="flex items-center gap-2 text-xs font-medium">
                  <CalendarClockIcon className="size-3.5" aria-hidden /> Student toolkit
                </span>
                <p className="mt-3 text-sm font-medium">4 ready-made routines</p>
                <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                  Assignments, revision, classes, and wellbeing
                </p>
              </div>
            </section>

            {showTemplates ? (
              <section
                aria-labelledby="starter-templates-heading"
                className="animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none"
              >
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 id="starter-templates-heading" className="text-base font-semibold">
                      Student starters
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick one to save its prompt and suggested timing.
                    </p>
                  </div>
                  <Button variant="ghost-muted" size="xs" onClick={closeTemplates}>
                    Close
                  </Button>
                </div>
                <div className="grid overflow-hidden rounded-xl border border-border/70 sm:grid-cols-2 lg:grid-cols-4">
                  {STUDENT_TASK_TEMPLATES.map((template, index) => {
                    const details = CATEGORY_DETAILS[template.category];
                    const Icon = details.icon;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => addTemplate(template.id)}
                        className={cn(
                          "group min-h-44 cursor-pointer p-4 text-left outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          index > 0 && "border-t border-border/70 sm:border-t-0",
                          index % 2 === 1 && "sm:border-l sm:border-border/70",
                          index > 1 && "sm:border-t sm:border-border/70 lg:border-t-0",
                          index === 2 && "lg:border-l lg:border-border/70",
                        )}
                      >
                        <span
                          className={cn(
                            "mb-7 flex size-8 items-center justify-center rounded-lg",
                            details.className,
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="block text-sm font-medium text-foreground">
                          {template.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {template.description}
                        </span>
                        <span className="mt-3 flex items-center gap-1 text-xs font-medium text-foreground opacity-70 group-hover:opacity-100">
                          <PlusIcon className="size-3" /> Save routine
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="your-schedule-heading">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h2 id="your-schedule-heading" className="text-base font-semibold">
                    Saved routines
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Student routine drafts saved in this browser.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>

              {tasks.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
                  <CalendarClockIcon className="size-6 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 text-sm font-medium">No routines saved</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Start with a student template built around common study work.
                  </p>
                  <Button className="mt-4" size="sm" onClick={() => setShowTemplates(true)}>
                    Browse starters
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  {tasks.map((task, index) => (
                    <ScheduledTaskRow
                      key={task.id}
                      task={task}
                      {...(index > 0 ? { className: "border-t border-border/70" } : {})}
                      onRemove={() => removeTask(task)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-4 border-t border-border/60 pt-7 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex gap-3">
                <SparklesIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <h2 className="text-sm font-medium">Built for changing timetables</h2>
                  <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">
                    Keep useful routines together now. Server-backed execution and cross-device
                    schedules can build on these drafts later.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                View all starters
              </Button>
            </section>
            <p className="sr-only" aria-live="polite">
              {statusMessage}
            </p>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}

function ScheduledTaskRow({
  className,
  onRemove,
  task,
}: {
  readonly className?: string;
  readonly onRemove: () => void;
  readonly task: StudentScheduledTask;
}) {
  const details = CATEGORY_DETAILS[task.category];
  const Icon = details.icon;
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelRemoveButtonRef = useRef<HTMLButtonElement>(null);

  const showRemoveConfirmation = () => {
    setConfirmingRemove(true);
    window.requestAnimationFrame(() => cancelRemoveButtonRef.current?.focus());
  };

  const cancelRemove = () => {
    setConfirmingRemove(false);
    window.requestAnimationFrame(() => removeButtonRef.current?.focus());
  };
  return (
    <article
      className={cn(
        "grid gap-4 bg-background px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            details.className,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{task.title}</h3>
            <span
              className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", details.className)}
            >
              {details.label}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {task.prompt}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock3Icon className="size-3" aria-hidden /> Suggested: {task.schedule}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        {confirmingRemove ? (
          <>
            <Button
              ref={cancelRemoveButtonRef}
              variant="ghost-muted"
              size="xs"
              onClick={cancelRemove}
            >
              Cancel
            </Button>
            <Button variant="destructive-outline" size="xs" onClick={onRemove}>
              Remove
            </Button>
          </>
        ) : (
          <Button
            ref={removeButtonRef}
            aria-label={`Remove ${task.title}`}
            variant="ghost-muted"
            size="icon-sm"
            onClick={showRemoveConfirmation}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </article>
  );
}
