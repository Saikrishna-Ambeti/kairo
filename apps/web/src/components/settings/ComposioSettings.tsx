import { msg, T, useGT, useMessages, Var } from "gt-react";
import { m, type MessageResolver } from "../../i18n/messages";
import { settlePromise, squashAtomCommandFailure } from "@kairo/client-runtime/state/runtime";
import type { ComposioStatus, ProviderInstanceId } from "@kairo/contracts";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  CloudIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

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

function serviceBadge(status: ComposioStatus["service"]["status"], resolve: MessageResolver) {
  if (status === "available")
    return { label: resolve(msg("Managed by Kairo")), variant: "success" as const };
  if (status === "error")
    return { label: resolve(msg("Connection failed")), variant: "destructive" as const };
  return { label: resolve(msg("Service unavailable")), variant: "outline" as const };
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
  const gt = useGT();
  const messages = useMessages();
  const { getComposioStatus, configureComposio, disableComposio } = usePrimaryServerApi();
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState<ProviderInstanceId[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);

  const refresh = async () => {
    setRefreshing(true);
    setStatusError(null);
    const result = await settlePromise(() => getComposioStatus());
    setRefreshing(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      setStatusError(errorMessage(error));
      throw error;
    }
    setStatus(result.value);
    setSelectedProviderIds(selectedProviders(result.value));
    return result.value;
  };

  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- reads Composio configuration from the connected host
  useEffect(() => {
    let disposed = false;
    void settlePromise(getComposioStatus).then((result) => {
      if (disposed) return;
      setLoading(false);
      if (result._tag === "Failure") {
        const error = squashAtomCommandFailure(result);
        setStatusError(errorMessage(error));
        showError(m(msg("Composio status unavailable")), error);
        return;
      }
      setStatus(result.value);
      setSelectedProviderIds(selectedProviders(result.value));
    });
    return () => void (disposed = true);
  }, [getComposioStatus]);

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
    const result = await settlePromise(async () => {
      const next = await configureComposio({
        providerInstanceIds: selectedProviderIds,
      });
      setStatus(next);
      setSelectedProviderIds(selectedProviders(next));
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: status?.enabled ? m(msg("Composio providers saved")) : m(msg("Composio enabled")),
          description: m(msg("New provider sessions will get managed app tools.")),
        }),
      );
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showError(m(msg("Could not enable Composio")), error);
    }
    setBusy(null);
  };

  const disable = async () => {
    const confirmed = await ensureLocalApi().dialogs.confirm(m(msg("Disable Composio app tools?")));
    if (!confirmed) return;
    setBusy("disable");
    const result = await settlePromise(async () => {
      const next = await disableComposio();
      setStatus(next);
      setSelectedProviderIds([]);
      toastManager.add(stackedThreadToast({ type: "success", title: m(msg("Composio disabled")) }));
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showError(m(msg("Could not disable Composio")), error);
    }
    setBusy(null);
  };

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<CloudIcon className="size-3.5" />} title={gt("Integrations")}>
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <T>Loading Composio</T>
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  const badge = serviceBadge(status?.service.status ?? "unavailable", messages);
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
      <SettingsSection icon={<CloudIcon className="size-3.5" />} title={gt("Composio")}>
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  <T>Managed app tools</T>
                </span>
                <Badge aria-live="polite" size="sm" variant={badge.variant}>
                  {badge.label}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <T>
                  Kairo Cloud connects agents to Composio. When a tool needs an app, the agent gives
                  you a secure sign-in link. No API key or local runtime needed.
                </T>
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={gt("Refresh Composio status")}
              disabled={busy !== null || refreshing}
              onClick={() =>
                void refresh().catch((error) => showError(gt("Refresh failed"), error))
              }
            >
              <RefreshCwIcon className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>

          {statusError ? (
            <Alert variant="error">
              <AlertDescription>
                <T>
                  Composio status could not be loaded. <Var>{statusError}</Var> Use refresh to try
                  again.
                </T>
              </AlertDescription>
            </Alert>
          ) : status?.service.lastError ? (
            <Alert variant="error">
              <AlertDescription>{status.service.lastError}</AlertDescription>
            </Alert>
          ) : status && !status.service.available ? (
            <Alert>
              <AlertDescription>
                <T>Sign in to Kairo and check that this host can reach Kairo Cloud.</T>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SettingsSection>

      {status ? (
        <SettingsSection title={gt("Agent access")}>
          <div className="divide-y divide-border/60">
            {status?.agentSupport.length === 0 ? (
              <div className="flex flex-col items-start gap-3 px-4 py-5 sm:px-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    <T>No providers available</T>
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <T>Add a provider before enabling Composio app tools.</T>
                  </p>
                </div>
                <Button size="sm" variant="outline" render={<Link to="/settings/providers" />}>
                  <T>Add provider</T>
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
            <p className="text-xs text-muted-foreground">
              <T>New provider sessions pick up changes.</T>
            </p>
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
                  <T>Disable</T>
                </Button>
              ) : null}
              <Button disabled={!canSave} onClick={() => void save()}>
                {busy === "save" ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="size-4" />
                )}
                {status.enabled ? gt("Save providers") : gt("Enable Composio")}
              </Button>
            </div>
          </div>
        </SettingsSection>
      ) : null}
    </SettingsPageContainer>
  );
}
