import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  CloudIcon,
  LoaderCircleIcon,
  PowerIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProviderInstanceId,
  SupermemoryProviderStatus,
  SupermemoryStatus,
} from "@kairo/contracts";

import { useServerProviders, useServerSettings } from "../../rpc/serverState";
import { usePrimaryServerApi } from "../../state/primaryServerApi";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

type BusyAction = "configure" | "providers" | "disable" | null;

const SUPPORTED_MEMORY_DRIVERS = new Set(["codex", "claudeAgent", "cursor", "grok", "opencode"]);

function showMemoryError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function useSupermemoryStatus() {
  const serverApi = usePrimaryServerApi();
  const [status, setStatus] = useState<SupermemoryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await serverApi.getMemoryStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    void refresh()
      .catch((error: unknown) => {
        if (!disposed) showMemoryError("Memory status unavailable", error);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [refresh]);

  return { status, setStatus, loading };
}

function statusBadgeVariant(status: SupermemoryProviderStatus["status"]) {
  switch (status) {
    case "ready":
      return "success";
    case "error":
    case "unsupported":
      return "error";
    case "needs_action":
      return "warning";
    default:
      return "outline";
  }
}

function statusLabel(status: SupermemoryProviderStatus["status"]): string {
  return status.replace(/_/g, " ");
}

function SupermemoryProviderSelector({
  providers,
  selected,
  onChange,
}: {
  providers: ReadonlyArray<SupermemoryProviderStatus>;
  selected: ReadonlySet<ProviderInstanceId>;
  onChange: (next: ReadonlySet<ProviderInstanceId>) => void;
}) {
  const toggle = (provider: SupermemoryProviderStatus, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(provider.instanceId);
    else next.delete(provider.instanceId);
    onChange(next);
  };

  return (
    <div className="divide-y rounded-xl border">
      {providers.map((provider) => {
        const disabled = !provider.supported;
        return (
          <label
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
              disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/35",
            )}
            key={provider.instanceId}
          >
            <Checkbox
              checked={selected.has(provider.instanceId)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(provider, Boolean(checked))}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{provider.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {provider.instanceId} · {provider.driver}
                {provider.message ? ` · ${provider.message}` : ""}
              </span>
            </span>
            <Badge size="sm" variant={statusBadgeVariant(provider.status)}>
              {statusLabel(provider.status)}
            </Badge>
          </label>
        );
      })}
    </div>
  );
}

function SupermemorySetupWizard({
  status,
  onStatus,
}: {
  status: SupermemoryStatus;
  onStatus: (status: SupermemoryStatus) => void;
}) {
  const serverApi = usePrimaryServerApi();
  const settings = useServerSettings();
  const serverProviders = useServerProviders();
  const [busy, setBusy] = useState<BusyAction>(null);
  const defaultProviderId = settings.textGenerationModelSelection.instanceId;
  const providers = useMemo(() => {
    if (status.providers.length > 0) return status.providers;
    return serverProviders.map((provider) => {
      const supported = SUPPORTED_MEMORY_DRIVERS.has(provider.driver);
      return {
        instanceId: provider.instanceId,
        driver: provider.driver,
        displayName: provider.displayName ?? String(provider.instanceId),
        selected: provider.instanceId === defaultProviderId,
        supported,
        status: supported ? ("not_selected" as const) : ("unsupported" as const),
      };
    });
  }, [defaultProviderId, serverProviders, status.providers]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<ProviderInstanceId>>(
    () =>
      new Set(
        providers
          .filter((provider) => provider.instanceId === defaultProviderId && provider.supported)
          .map((provider) => provider.instanceId),
      ),
  );

  useEffect(() => {
    if (selectedIds.size > 0 || providers.length === 0) return;
    const defaultProvider = providers.find(
      (provider) => provider.instanceId === defaultProviderId && provider.supported,
    );
    if (defaultProvider) setSelectedIds(new Set([defaultProvider.instanceId]));
  }, [defaultProviderId, providers, selectedIds.size]);

  const configure = async () => {
    if (selectedIds.size === 0) return;
    setBusy("configure");
    try {
      const next = await serverApi.configureMemory({ providerInstanceIds: [...selectedIds] });
      onStatus(next);
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "Memory enabled",
          description: "Memory will be available in new provider sessions.",
        }),
      );
    } catch (error) {
      showMemoryError("Memory setup failed", error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title="Memory">
        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Provider instances</div>
            <SupermemoryProviderSelector
              onChange={setSelectedIds}
              providers={providers}
              selected={selectedIds}
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={selectedIds.size === 0 || busy !== null || !status.service.available}
              onClick={configure}
            >
              {busy === "configure" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Enable memory
            </Button>
          </div>
          {!status.service.available ? (
            <p className="text-xs text-warning">
              This Kairo host does not have working Kairo Cloud access.
            </p>
          ) : null}
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function SupermemoryStatusSummary({ status }: { status: SupermemoryStatus }) {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-3">
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">Service</div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <CloudIcon className="size-4" />
          Hosted
        </div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">Setup</div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2Icon
            className={cn("size-4", status.service.available ? "text-success" : "text-warning")}
          />
          {status.service.available ? "Managed by Kairo" : "Service unavailable"}
        </div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">Scope</div>
        <div className="mt-1 text-sm font-semibold">User-wide</div>
      </div>
    </div>
  );
}

function ConfiguredSupermemoryPanel({
  status,
  onStatus,
}: {
  status: SupermemoryStatus;
  onStatus: (status: SupermemoryStatus) => void;
}) {
  const serverApi = usePrimaryServerApi();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<ProviderInstanceId>>(
    () =>
      new Set(
        status.providers
          .filter((provider) => provider.selected)
          .map((provider) => provider.instanceId),
      ),
  );

  useEffect(() => {
    setSelectedIds(
      new Set(
        status.providers
          .filter((provider) => provider.selected)
          .map((provider) => provider.instanceId),
      ),
    );
  }, [status.providers]);

  const runAction = async (action: BusyAction, task: () => Promise<SupermemoryStatus>) => {
    setBusy(action);
    try {
      onStatus(await task());
    } catch (error) {
      showMemoryError("Memory action failed", error);
    } finally {
      setBusy(null);
    }
  };

  const providersChanged = status.providers.some(
    (provider) => provider.selected !== selectedIds.has(provider.instanceId),
  );

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title="Supermemory">
        <SupermemoryStatusSummary status={status} />
        <div className="space-y-3 border-t p-5">
          <div className="text-xs font-medium text-muted-foreground">Provider instances</div>
          <SupermemoryProviderSelector
            onChange={setSelectedIds}
            providers={status.providers}
            selected={selectedIds}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              disabled={busy !== null}
              onClick={() => runAction("disable", () => serverApi.disableMemory())}
              size="sm"
              variant="destructive-outline"
            >
              <PowerIcon className="size-4" />
              Disable memory
            </Button>
            <Button
              disabled={busy !== null || selectedIds.size === 0 || !providersChanged}
              onClick={() =>
                runAction("providers", () =>
                  serverApi.configureMemory({ providerInstanceIds: [...selectedIds] }),
                )
              }
              size="sm"
            >
              {busy === "providers" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Save providers
            </Button>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function SupermemorySettingsPanel() {
  const { status, setStatus, loading } = useSupermemoryStatus();

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title="Memory">
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading memory status
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  if (!status || !status.enabled) {
    return status ? <SupermemorySetupWizard onStatus={setStatus} status={status} /> : null;
  }

  return <ConfiguredSupermemoryPanel onStatus={setStatus} status={status} />;
}
