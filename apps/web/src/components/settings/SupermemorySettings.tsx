import { msg, T, useGT } from "gt-react";
import { m } from "../../i18n/messages";
import { settlePromise, squashAtomCommandFailure } from "@kairo/client-runtime/state/runtime";
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  CloudIcon,
  LoaderCircleIcon,
  PowerIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const { getMemoryStatus } = usePrimaryServerApi();
  const [status, setStatus] = useState<SupermemoryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- reads memory configuration from the connected host
  useEffect(() => {
    let disposed = false;
    void settlePromise(getMemoryStatus).then((result) => {
      if (disposed) return;
      setLoading(false);
      if (result._tag === "Failure") {
        showMemoryError(m(msg("Memory status unavailable")), squashAtomCommandFailure(result));
        return;
      }
      setStatus(result.value);
    });
    return () => void (disposed = true);
  }, [getMemoryStatus]);

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
  const gt = useGT();
  const serverApi = usePrimaryServerApi();
  const settings = useServerSettings();
  const serverProviders = useServerProviders();
  const [busy, setBusy] = useState<BusyAction>(null);
  const defaultProviderId = settings.textGenerationModelSelection.instanceId;
  const providers = (() => {
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
  })();
  const [selection, setSelectedIds] = useState<ReadonlySet<ProviderInstanceId> | null>(null);
  const defaultProvider = providers.find(
    (provider) => provider.instanceId === defaultProviderId && provider.supported,
  );
  const selectedIds = selection ?? new Set(defaultProvider ? [defaultProvider.instanceId] : []);

  const configure = async () => {
    if (selectedIds.size === 0) return;
    setBusy("configure");
    const result = await settlePromise(async () => {
      const next = await serverApi.configureMemory({ providerInstanceIds: [...selectedIds] });
      onStatus(next);
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: m(msg("Memory enabled")),
          description: m(msg("Memory will be available in new provider sessions.")),
        }),
      );
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showMemoryError(m(msg("Memory setup failed")), error);
    }
    setBusy(null);
  };

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title={gt("Memory")}>
        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              <T>Provider instances</T>
            </div>
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
              <T>Enable memory</T>
            </Button>
          </div>
          {!status.service.available ? (
            <p className="text-xs text-warning">
              <T>This Kairo host does not have working Kairo Cloud access.</T>
            </p>
          ) : null}
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}

function SupermemoryStatusSummary({ status }: { status: SupermemoryStatus }) {
  const gt = useGT();
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-3">
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">
          <T>Service</T>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <CloudIcon className="size-4" />
          <T>Hosted</T>
        </div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">
          <T>Setup</T>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2Icon
            className={cn("size-4", status.service.available ? "text-success" : "text-warning")}
          />
          {status.service.available ? gt("Managed by Kairo") : gt("Service unavailable")}
        </div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-muted-foreground">
          <T>Scope</T>
        </div>
        <div className="mt-1 text-sm font-semibold">
          <T>User-wide</T>
        </div>
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
  const gt = useGT();
  const serverApi = usePrimaryServerApi();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [draft, setDraft] = useState<{
    providers: SupermemoryStatus["providers"];
    selectedIds: ReadonlySet<ProviderInstanceId>;
  } | null>(null);
  const selectedIds =
    draft?.providers === status.providers
      ? draft.selectedIds
      : new Set(
          status.providers
            .filter((provider) => provider.selected)
            .map((provider) => provider.instanceId),
        );
  const setSelectedIds = (ids: ReadonlySet<ProviderInstanceId>) =>
    setDraft({ providers: status.providers, selectedIds: ids });

  const runAction = async (action: BusyAction, task: () => Promise<SupermemoryStatus>) => {
    setBusy(action);
    const result = await settlePromise(async () => {
      onStatus(await task());
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showMemoryError(m(msg("Memory action failed")), error);
    }
    setBusy(null);
  };

  const providersChanged = status.providers.some(
    (provider) => provider.selected !== selectedIds.has(provider.instanceId),
  );

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title={gt("Supermemory")}>
        <SupermemoryStatusSummary status={status} />
        <div className="space-y-3 border-t p-5">
          <div className="text-xs font-medium text-muted-foreground">
            <T>Provider instances</T>
          </div>
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
              <T>Disable memory</T>
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
              <T>Save providers</T>
            </Button>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function SupermemorySettingsPanel() {
  const gt = useGT();
  const { status, setStatus, loading } = useSupermemoryStatus();

  if (loading && !status) {
    return (
      <SettingsPageContainer>
        <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title={gt("Memory")}>
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <T>Loading memory status</T>
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
