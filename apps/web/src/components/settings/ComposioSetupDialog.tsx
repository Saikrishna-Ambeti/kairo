import type { ComposioOperationProgressEvent } from "@kairo/contracts";
import { CheckCircle2Icon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";

import { ensureLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import {
  getComposioSetupDialogCopy,
  getComposioSetupSteps,
  type SetupMode,
} from "./IntegrationsSettings.logic";

function SetupStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full border",
          done && "border-success/40 bg-success/10 text-success",
          active && !done && "border-info/40 bg-info/10 text-info",
          !active && !done && "border-border text-muted-foreground",
        )}
      >
        {done ? (
          <CheckCircle2Icon className="size-3" />
        ) : active ? (
          <LoaderCircleIcon className="size-3 animate-spin" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <span className={active || done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export function ComposioSetupDialog({
  open,
  mode,
  events,
  authUrl,
  onOpenChange,
}: {
  open: boolean;
  mode: SetupMode;
  events: ReadonlyArray<ComposioOperationProgressEvent>;
  authUrl: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const latest = events.at(-1);
  const { title, description } = getComposioSetupDialogCopy(mode);
  const steps = getComposioSetupSteps(mode);
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step === latest?.stage),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((step, index) => (
              <SetupStep
                key={step}
                label={step}
                active={index === activeIndex && latest?.operation.status === "running"}
                done={
                  latest?.operation.status === "succeeded" ||
                  (latest?.operation.status === "running" && index < activeIndex)
                }
              />
            ))}
          </div>
          {authUrl ? (
            <Alert>
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all text-xs">{authUrl}</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void ensureLocalApi().shell.openExternal(authUrl)}
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open in browser
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="rounded-xl border bg-muted/25">
            <ScrollArea className="h-44">
              <div className="space-y-2 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                {events.length === 0 ? (
                  <div>Waiting for setup progress...</div>
                ) : (
                  events.map((event) => (
                    <div
                      key={`${event.operation.id}:${event.operation.updatedAt}:${event.stage}:${event.message}`}
                    >
                      <span className="text-foreground">{event.stage}</span>: {event.message}
                      {event.stdout ? (
                        <pre className="whitespace-pre-wrap">{event.stdout}</pre>
                      ) : null}
                      {event.stderr ? (
                        <pre className="whitespace-pre-wrap">{event.stderr}</pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
