import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ComposioOperationProgressEvent,
  ComposioStatus,
  ComposioToolkitStatus,
  ProviderInstanceId,
} from "@kairo/contracts";

import { ensureLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
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
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  getComposioPrimaryButtonState,
  getConnectedComposioToolkits,
  getComposioSetupDialogCopy,
  getComposioSetupSteps,
  shouldShowComposioBackgroundOperation,
  type SetupMode,
} from "./IntegrationsSettings.logic";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

function showComposioError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function cliBadgeVariant(status: ComposioStatus["cli"]["status"]) {
  switch (status) {
    case "authenticated":
      return "success";
    case "missing":
    case "needs_login":
    case "installing":
      return "warning";
    case "error":
    case "unsupported":
      return "error";
    default:
      return "outline";
  }
}

function connectionBadgeVariant(status: ComposioToolkitStatus["connectionStatus"]) {
  switch (status) {
    case "connected":
      return "success";
    case "not_connected":
      return "warning";
    case "error":
      return "error";
    default:
      return "outline";
  }
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

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

function ToolkitRow({
  toolkit,
  disabled,
  onConnect,
}: {
  toolkit: ComposioToolkitStatus;
  disabled: boolean;
  onConnect: (toolkit: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-semibold">{toolkit.label}</span>
          <Badge size="sm" variant={connectionBadgeVariant(toolkit.connectionStatus)}>
            {formatStatus(toolkit.connectionStatus)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground/80">
          {toolkit.accountLabel
            ? `Connected as ${toolkit.accountLabel}`
            : (toolkit.message ?? `Toolkit slug: ${toolkit.toolkit}`)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onConnect(toolkit.toolkit)}
      >
        <PlugZapIcon className="size-3.5" />
        Connect
      </Button>
    </div>
  );
}

export function IntegrationsSettings() {
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<SetupMode>("install_and_login");
  const [events, setEvents] = useState<ComposioOperationProgressEvent[]>([]);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seenRunningOperationRef = useRef<string | null>(null);
  const backgroundRefreshStartedRef = useRef(false);

  const selectedProviderIds = useMemo(
    () =>
      status?.agentSupport
        .filter((entry) => entry.selected)
        .map((entry) => entry.providerInstanceId) ?? [],
    [status?.agentSupport],
  );

  const refresh = useCallback(async () => {
    const next = await ensureLocalApi().server.getComposioStatus();
    setStatus((previous) => {
      const previousOperation = previous?.operation;
      const nextOperation = next.operation;
      if (previousOperation?.status === "running" && nextOperation?.status === "succeeded") {
        toastManager.add(stackedThreadToast({ type: "success", title: "Composio setup complete" }));
      }
      if (previousOperation?.status === "running" && nextOperation?.status === "failed") {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Composio setup failed",
            description: nextOperation.message ?? "Setup failed.",
          }),
        );
      }
      return next;
    });
    return next;
  }, []);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    void refresh()
      .catch((error: unknown) => {
        if (!disposed) showComposioError("Composio status unavailable", error);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (status?.operation?.status !== "running") return;
    seenRunningOperationRef.current = status.operation.id;
    const id = window.setInterval(() => void refresh().catch(() => undefined), 2_000);
    return () => window.clearInterval(id);
  }, [refresh, status?.operation]);

  useEffect(() => {
    if (!status || backgroundRefreshStartedRef.current) return;
    backgroundRefreshStartedRef.current = true;
    const timeoutIds = [1_500, 4_000, 8_000].map((delay) =>
      window.setTimeout(() => void refresh().catch(() => undefined), delay),
    );
    return () => {
      for (const id of timeoutIds) window.clearTimeout(id);
    };
  }, [refresh, status]);

  const appendProgress = (event: ComposioOperationProgressEvent) => {
    setEvents((previous) => [...previous, event].slice(-80));
    if (event.authUrl) setAuthUrl(event.authUrl);
    setStatus((previous) =>
      previous
        ? {
            ...previous,
            operation: event.operation,
          }
        : previous,
    );
  };

  const runSetup = async (mode: SetupMode) => {
    setSetupMode(mode);
    setEvents([]);
    setAuthUrl(null);
    setDialogOpen(true);
    setBusy(true);
    try {
      const next =
        mode === "install_and_login"
          ? await ensureLocalApi().server.installAndLoginComposio(
              { providerInstanceIds: selectedProviderIds },
              appendProgress,
            )
          : await ensureLocalApi().server.loginComposio(
              { providerInstanceIds: selectedProviderIds },
              appendProgress,
            );
      setStatus(next);
      if (next.operation?.status === "failed") {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Composio setup failed",
            description: next.operation.message ?? "Setup failed.",
          }),
        );
      } else {
        toastManager.add(stackedThreadToast({ type: "success", title: "Composio setup complete" }));
      }
    } catch (error) {
      showComposioError("Composio setup failed", error);
      void refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const connectToolkit = async (toolkit: string) => {
    setSetupMode("login");
    setEvents([]);
    setAuthUrl(null);
    setDialogOpen(true);
    setBusy(true);
    try {
      const next = await ensureLocalApi().server.linkComposioToolkit({ toolkit }, appendProgress);
      setStatus(next);
      toastManager.add(stackedThreadToast({ type: "success", title: `${toolkit} connected` }));
    } catch (error) {
      showComposioError(`Could not connect ${toolkit}`, error);
      void refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleProvider = async (providerInstanceId: ProviderInstanceId, checked: boolean) => {
    if (!status) return;
    const nextSelected = new Set(selectedProviderIds);
    if (checked) nextSelected.add(providerInstanceId);
    else nextSelected.delete(providerInstanceId);
    try {
      const next = await ensureLocalApi().server.installComposioAgentSupport({
        providerInstanceIds: [...nextSelected],
      });
      setStatus(next);
    } catch (error) {
      showComposioError("Could not update agent access", error);
    }
  };

  const primaryAction = status?.primaryAction ?? "install_and_login";
  const operationRunning = status?.operation?.status === "running";
  const primaryButton = getComposioPrimaryButtonState({
    primaryAction,
    busy,
    operationRunning,
  });
  const connectedToolkits = getConnectedComposioToolkits(status);

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<PlugZapIcon className="size-3.5" />} title="Integrations">
          <div className="p-5 text-sm text-muted-foreground">Loading integrations...</div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<PlugZapIcon className="size-3.5" />} title="Composio CLI">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TerminalIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Composio local tool access</span>
                {status ? (
                  <Badge size="sm" variant={cliBadgeVariant(status.cli.status)}>
                    {formatStatus(operationRunning ? "installing" : status.cli.status)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground/80">
                {status?.cli.executablePath
                  ? `Using ${status.cli.executablePath}`
                  : (status?.cli.message ?? "Connect Composio to let agents use external apps.")}
              </p>
            </div>
            <div className="flex gap-2">
              {primaryAction !== "none" ? (
                <Button
                  disabled={primaryButton.disabled}
                  onClick={() => void runSetup(primaryAction)}
                >
                  {busy || operationRunning ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : (
                    <PlugZapIcon className="size-4" />
                  )}
                  {operationRunning ? primaryButton.runningLabel : primaryButton.label}
                </Button>
              ) : null}
              {operationRunning ? (
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  View progress
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Refresh Composio status"
                onClick={() => void refresh()}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
          </div>
          {shouldShowComposioBackgroundOperation(status, dialogOpen) ? (
            <Alert>
              <AlertDescription>
                Composio setup is running in the background. You can reopen progress from this page.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title="Connected apps">
        {connectedToolkits.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
            No Composio apps are connected yet. Ask the agent to connect an app, or use Show more to
            browse available toolkits.
          </div>
        ) : (
          connectedToolkits.map((toolkit) => (
            <ToolkitRow
              key={toolkit.toolkit}
              toolkit={toolkit}
              disabled={busy || operationRunning || status?.auth.status !== "authenticated"}
              onConnect={connectToolkit}
            />
          ))
        )}
        <div className="border-t border-border/60 px-4 py-4 sm:px-5">
          <Button variant="outline" render={<Link to="/settings/integrations/apps" />}>
            <PlugZapIcon className="size-3.5" />
            Show more
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Agent access">
        <div className="divide-y divide-border/60">
          {(status?.agentSupport ?? []).map((provider) => (
            <label
              key={provider.providerInstanceId}
              className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-muted/35 sm:px-5"
            >
              <Checkbox
                checked={provider.selected}
                onCheckedChange={(checked) =>
                  void toggleProvider(provider.providerInstanceId, Boolean(checked))
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{provider.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {provider.message}
                </span>
              </span>
              <Badge size="sm" variant={provider.skillStatus === "ready" ? "success" : "outline"}>
                {formatStatus(provider.skillStatus)}
              </Badge>
            </label>
          ))}
        </div>
      </SettingsSection>

      <ComposioSetupDialog
        open={dialogOpen}
        mode={setupMode}
        events={events}
        authUrl={authUrl}
        onOpenChange={setDialogOpen}
      />
    </SettingsPageContainer>
  );
}
