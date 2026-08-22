import type { ComposioStatus, ProviderInstanceId } from "@kairo/contracts";
import {
  CheckCircle2Icon,
  CloudIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

const COMPOSIO_DASHBOARD_URL = "https://dashboard.composio.dev";

function showError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function authBadge(status: ComposioStatus["auth"]["status"]) {
  if (status === "configured") return { label: "Connected", variant: "success" as const };
  if (status === "error") return { label: "Connection failed", variant: "destructive" as const };
  return { label: "Not configured", variant: "outline" as const };
}

export function IntegrationsSettings() {
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState<ProviderInstanceId[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await ensureLocalApi().server.getComposioStatus();
    setStatus(next);
    setSelectedProviderIds(
      next.agentSupport
        .filter((provider) => provider.selected)
        .map((provider) => provider.providerInstanceId),
    );
    return next;
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
    setBusy(true);
    try {
      const trimmedApiKey = apiKey.trim();
      await ensureLocalApi().server.configureComposio({
        ...(trimmedApiKey ? { apiKey: trimmedApiKey } : {}),
        providerInstanceIds: selectedProviderIds,
      });
      const tested = await ensureLocalApi().server.testComposioConnection(
        trimmedApiKey ? { apiKey: trimmedApiKey } : undefined,
      );
      setStatus(tested);
      setApiKey("");
      if (tested.auth.status === "error") {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Composio connection failed",
            description: tested.auth.lastError,
          }),
        );
      } else {
        toastManager.add(
          stackedThreadToast({ type: "success", title: "Composio Connect enabled" }),
        );
      }
    } catch (error) {
      showError("Could not configure Composio", error);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      "Disable Composio Connect and remove its saved API key?",
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const next = await ensureLocalApi().server.disableComposio();
      setStatus(next);
      setSelectedProviderIds([]);
      setApiKey("");
      toastManager.add(stackedThreadToast({ type: "success", title: "Composio disabled" }));
    } catch (error) {
      showError("Could not disable Composio", error);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<CloudIcon className="size-3.5" />} title="Integrations">
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading Composio Connect...
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  const badge = authBadge(status?.auth.status ?? "not_configured");
  const canSave =
    !busy &&
    selectedProviderIds.length > 0 &&
    (status?.auth.hasApiKey === true || apiKey.trim().length > 0);

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<CloudIcon className="size-3.5" />} title="Composio Connect">
        <div className="space-y-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Hosted app tools</span>
                <Badge size="sm" variant={badge.variant}>
                  {badge.label}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Agents connect to Composio's hosted MCP server. No local Composio runtime is
                installed. Account authorization and tool execution stay in Composio Connect.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void ensureLocalApi().shell.openExternal(COMPOSIO_DASHBOARD_URL)}
              >
                <ExternalLinkIcon className="size-4" />
                Manage apps
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Refresh Composio status"
                onClick={() => void refresh().catch((error) => showError("Refresh failed", error))}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
          </div>

          {status?.auth.lastError ? (
            <Alert variant="error">
              <AlertDescription>{status.auth.lastError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-medium">
                <KeyRoundIcon className="size-3.5 text-muted-foreground" />
                Composio Connect API key
              </span>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                placeholder={
                  status?.auth.hasApiKey
                    ? "Saved. Enter a new key to replace it."
                    : "Paste your x-consumer-api-key"
                }
              />
            </label>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Get this key from Composio Dashboard under AI Clients. Kairo stores it in the
              environment secret store and passes it only to selected providers.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Agent access">
        <div className="divide-y divide-border/60">
          {(status?.agentSupport ?? []).map((provider) => (
            <label
              key={provider.providerInstanceId}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-muted/35 sm:px-5"
            >
              <Checkbox
                checked={selectedProviderIds.includes(provider.providerInstanceId)}
                disabled={!provider.supported || busy}
                onCheckedChange={(checked) =>
                  toggleProvider(provider.providerInstanceId, Boolean(checked))
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{provider.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {provider.message}
                </span>
              </span>
              <Badge size="sm" variant={provider.status === "ready" ? "success" : "outline"}>
                {provider.status.replaceAll("_", " ")}
              </Badge>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-4 sm:px-5">
          <p className="text-xs text-muted-foreground">
            New provider sessions pick up saved changes.
          </p>
          <div className="flex gap-2">
            {status?.enabled ? (
              <Button variant="outline" disabled={busy} onClick={() => void disable()}>
                <UnplugIcon className="size-4" />
                Disable
              </Button>
            ) : null}
            <Button disabled={!canSave} onClick={() => void save()}>
              {busy ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <CheckCircle2Icon className="size-4" />
              )}
              Save and test
            </Button>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
