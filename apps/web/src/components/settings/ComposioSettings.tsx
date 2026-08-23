import type { ComposioStatus, ProviderInstanceId } from "@kairo/contracts";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  CloudIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { ensureLocalApi } from "../../localApi";
import { usePrimaryServerApi } from "../../state/primaryServerApi";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

function showError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serviceBadge(status: ComposioStatus["service"]["status"]) {
  if (status === "available") return { label: "Managed by Kairo", variant: "success" as const };
  if (status === "error") return { label: "Connection failed", variant: "destructive" as const };
  return { label: "Service unavailable", variant: "outline" as const };
}

function providerBadgeVariant(status: ComposioStatus["agentSupport"][number]["status"]) {
  switch (status) {
    case "ready":
      return "success";
    case "needs_action":
      return "warning";
    case "unsupported":
      return "error";
    default:
      return "outline";
  }
}

function selectedProviders(status: ComposioStatus) {
  return status.agentSupport
    .filter((provider) => provider.selected)
    .map((provider) => provider.providerInstanceId);
}

type BusyAction = "save" | "disable" | null;

export function ComposioSettingsPanel() {
  const serverApi = usePrimaryServerApi();
  const serverApiRef = useRef(serverApi);
  serverApiRef.current = serverApi;
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState<ProviderInstanceId[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setStatusError(null);
    try {
      const next = await serverApiRef.current.getComposioStatus();
      setStatus(next);
      setSelectedProviderIds(selectedProviders(next));
      return next;
    } catch (error) {
      setStatusError(errorMessage(error));
      throw error;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void refresh()
      .catch((error: unknown) => {
        if (!disposed) showError("Composio status unavailable", error);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => void (disposed = true);
  }, [refresh]);

  const toggleProvider = (providerInstanceId: ProviderInstanceId, checked: boolean) => {
    setSelectedProviderIds((current) => {
      const next = new Set(current);
      if (checked) next.add(providerInstanceId);
      else next.delete(providerInstanceId);
      return [...next];
    });
  };

  const save = async () => {
    setBusy("save");
    try {
      const next = await serverApi.configureComposio({
        providerInstanceIds: selectedProviderIds,
      });
      setStatus(next);
      setSelectedProviderIds(selectedProviders(next));
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: status?.enabled ? "Composio providers saved" : "Composio enabled",
          description: "New provider sessions will get managed app tools.",
        }),
      );
    } catch (error) {
      showError("Could not enable Composio", error);
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    const confirmed = await ensureLocalApi().dialogs.confirm("Disable Composio app tools?");
    if (!confirmed) return;
    setBusy("disable");
    try {
      const next = await serverApi.disableComposio();
      setStatus(next);
      setSelectedProviderIds([]);
      toastManager.add(stackedThreadToast({ type: "success", title: "Composio disabled" }));
    } catch (error) {
      showError("Could not disable Composio", error);
    } finally {
      setBusy(null);
    }
  };

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<CloudIcon className="size-3.5" />} title="Integrations">
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading Composio
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  const badge = serviceBadge(status?.service.status ?? "unavailable");
  const providersChanged = (status?.agentSupport ?? []).some(
    (provider) => provider.selected !== selectedProviderIds.includes(provider.providerInstanceId),
  );
  const canSave =
    busy === null &&
    !refreshing &&
    selectedProviderIds.length > 0 &&
    status?.service.available === true &&
    (status.enabled === false || providersChanged);

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<CloudIcon className="size-3.5" />} title="Composio">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Managed app tools</span>
                <Badge aria-live="polite" size="sm" variant={badge.variant}>
                  {badge.label}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kairo Cloud connects agents to Composio. When a tool needs an app, the agent gives
                you a secure sign-in link. No API key or local runtime needed.
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Refresh Composio status"
              disabled={busy !== null || refreshing}
              onClick={() => void refresh().catch((error) => showError("Refresh failed", error))}
            >
              <RefreshCwIcon className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>

          {statusError ? (
            <Alert variant="error">
              <AlertDescription>
                Composio status could not be loaded. {statusError} Use refresh to try again.
              </AlertDescription>
            </Alert>
          ) : status?.service.lastError ? (
            <Alert variant="error">
              <AlertDescription>{status.service.lastError}</AlertDescription>
            </Alert>
          ) : status && !status.service.available ? (
            <Alert>
              <AlertDescription>
                Sign in to Kairo and check that this host can reach Kairo Cloud.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SettingsSection>

      {status ? (
        <SettingsSection title="Agent access">
          <div className="divide-y divide-border/60">
            {status?.agentSupport.length === 0 ? (
              <div className="flex flex-col items-start gap-3 px-4 py-5 sm:px-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">No providers available</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Add a provider before enabling Composio app tools.
                  </p>
                </div>
                <Button size="sm" variant="outline" render={<Link to="/settings/providers" />}>
                  Add provider
                </Button>
              </div>
            ) : null}
            {status.agentSupport.map((provider) => (
              <label
                key={provider.providerInstanceId}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 sm:px-5",
                  provider.supported ? "cursor-pointer hover:bg-muted/35" : "opacity-60",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selectedProviderIds.includes(provider.providerInstanceId)}
                  disabled={!provider.supported || busy !== null || refreshing}
                  onCheckedChange={(checked) =>
                    toggleProvider(provider.providerInstanceId, Boolean(checked))
                  }
                />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">
                    {provider.displayName}
                  </span>
                  <span className="block break-words text-xs leading-relaxed text-muted-foreground">
                    {provider.message}
                  </span>
                </span>
                <Badge className="mt-0.5" size="sm" variant={providerBadgeVariant(provider.status)}>
                  {provider.status.replaceAll("_", " ")}
                </Badge>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-4 sm:px-5">
            <p className="text-xs text-muted-foreground">New provider sessions pick up changes.</p>
            <div className="flex flex-wrap justify-end gap-2">
              {status.enabled ? (
                <Button
                  variant="outline"
                  disabled={busy !== null || refreshing}
                  onClick={() => void disable()}
                >
                  {busy === "disable" ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : (
                    <UnplugIcon className="size-4" />
                  )}
                  Disable
                </Button>
              ) : null}
              <Button disabled={!canSave} onClick={() => void save()}>
                {busy === "save" ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="size-4" />
                )}
                {status.enabled ? "Save providers" : "Enable Composio"}
              </Button>
            </div>
          </div>
        </SettingsSection>
      ) : null}
    </SettingsPageContainer>
  );
}
