import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  CloudIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  PowerIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProviderInstanceId,
  SupermemoryProviderStatus,
  SupermemoryStatus,
} from "@kairo/contracts";

import { ensureLocalApi } from "../../localApi";
import { useServerProviders, useServerSettings } from "../../rpc/serverState";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

type BusyAction = "configure" | "test" | "install" | "providers" | "rotate" | "disable" | null;

type TestConnectionState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

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
  const [status, setStatus] = useState<SupermemoryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await ensureLocalApi().server.getMemoryStatus();
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

  return { status, setStatus, loading, refresh };
}

function statusBadgeVariant(status: SupermemoryProviderStatus["status"]) {
  switch (status) {
    case "ready":
      return "success";
    case "error":
    case "unsupported":
      return "error";
    case "needs_action":
    case "needs_install":
      return "warning";
    case "installing":
      return "info";
    default:
      return "outline";
  }
}

function statusLabel(status: SupermemoryProviderStatus["status"]): string {
  return status.replace(/_/g, " ");
}

function ProviderBillingNote() {
  return (
    <p className="rounded-lg border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
      Codex memory is free on hosted. Hosted memory for non-Codex providers may require a paid
      Supermemory plan.
    </p>
  );
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
    if (checked) {
      next.add(provider.instanceId);
    } else {
      next.delete(provider.instanceId);
    }
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
  const settings = useServerSettings();
  const serverProviders = useServerProviders();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const defaultProviderId = settings.textGenerationModelSelection.instanceId;
  const providers = useMemo(() => {
    if (status.providers.length > 0) return status.providers;
    return serverProviders.map((provider) => ({
      instanceId: provider.instanceId,
      driver: provider.driver,
      displayName: provider.displayName ?? String(provider.instanceId),
      selected: provider.instanceId === defaultProviderId,
      supported:
        provider.driver === "codex" ||
        provider.driver === "claudeAgent" ||
        provider.driver === "opencode",
      status:
        provider.driver === "codex" ||
        provider.driver === "claudeAgent" ||
        provider.driver === "opencode"
          ? ("not_selected" as const)
          : ("unsupported" as const),
    }));
  }, [defaultProviderId, serverProviders, status.providers]);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<ProviderInstanceId>>(
    () =>
      new Set(
        providers
          .filter((provider) =>
            status.enabled
              ? provider.selected
              : provider.instanceId === defaultProviderId && provider.supported,
          )
          .map((provider) => provider.instanceId),
      ),
  );

  useEffect(() => {
    if (selectedIds.size > 0 || providers.length === 0) return;
    const defaultProvider = providers.find(
      (provider) => provider.instanceId === defaultProviderId && provider.supported,
    );
    if (defaultProvider) {
      setSelectedIds(new Set([defaultProvider.instanceId]));
    }
  }, [defaultProviderId, providers, selectedIds.size]);

  const canSubmit = selectedIds.size > 0 && apiKey.trim().length > 0;

  const configure = async () => {
    if (!canSubmit) return;
    setBusy("configure");
    try {
      const trimmedApiKey = apiKey.trim();
      const next = await ensureLocalApi().server.configureMemory({
        providerInstanceIds: [...selectedIds],
        ...(trimmedApiKey ? { apiKey: trimmedApiKey } : {}),
      });
      onStatus(next);
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "Memory configured",
          description: "Selected providers will receive Supermemory bindings on restart.",
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
            <label className="text-xs font-medium text-muted-foreground" htmlFor="sm-api-key">
              Supermemory API key
            </label>
            <Input
              id="sm-api-key"
              nativeInput
              onChange={(event) => setApiKey(event.currentTarget.value)}
              placeholder="sm_..."
              type="password"
              value={apiKey}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Provider instances</div>
            <ProviderBillingNote />
            <SupermemoryProviderSelector
              onChange={setSelectedIds}
              providers={providers}
              selected={selectedIds}
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={!canSubmit || busy !== null} onClick={configure}>
              {busy === "configure" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Enable Memory
            </Button>
          </div>
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
        <div className="text-xs text-muted-foreground">Auth</div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          {status.auth.hasApiKey ? (
            <CheckCircle2Icon className="size-4 text-success" />
          ) : (
            <KeyRoundIcon className="size-4 text-warning" />
          )}
          {status.auth.hasApiKey ? "API key saved" : "Missing API key"}
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
  const [busy, setBusy] = useState<BusyAction>(null);
  const [testConnection, setTestConnection] = useState<TestConnectionState>({ status: "idle" });
  const [editingProviders, setEditingProviders] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<ProviderInstanceId>>(
    () =>
      new Set(
        status.providers
          .filter((provider) => provider.selected)
          .map((provider) => provider.instanceId),
      ),
  );
  const [rotatedKey, setRotatedKey] = useState("");

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

  const testMemoryConnection = async () => {
    setBusy("test");
    setTestConnection({ status: "testing" });
    try {
      const next = await ensureLocalApi().server.testMemoryConnection();
      onStatus(next);
      if (next.auth.lastError) {
        setTestConnection({ status: "error", message: next.auth.lastError });
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Connection test failed",
            description: next.auth.lastError,
          }),
        );
      } else {
        const message = "Connection successful. Supermemory is ready to use.";
        setTestConnection({ status: "success", message });
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: "Connection successful",
            description: "Supermemory is ready to use.",
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestConnection({ status: "error", message });
      showMemoryError("Connection test failed", error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsPageContainer>
      <SettingsSection icon={<BrainCircuitIcon className="size-3.5" />} title="Supermemory">
        <SupermemoryStatusSummary status={status} />
        <div className="space-y-4 border-t p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null}
              onClick={testMemoryConnection}
              size="sm"
              variant="outline"
            >
              {busy === "test" ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <PlugZapIcon className="size-4" />
              )}
              Test connection
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() => setEditingProviders((open) => !open)}
              size="sm"
              variant="outline"
            >
              Edit providers
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() =>
                runAction("install", () =>
                  ensureLocalApi().server.installMemoryProviders({
                    providerInstanceIds: status.providers
                      .filter((provider) => provider.selected && provider.supported)
                      .map((provider) => provider.instanceId),
                  }),
                )
              }
              size="sm"
              variant="outline"
            >
              Install providers
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() => runAction("disable", () => ensureLocalApi().server.disableMemory())}
              size="sm"
              variant="destructive-outline"
            >
              <PowerIcon className="size-4" />
              Disable memory
            </Button>
          </div>
          {testConnection.status === "testing" ? (
            <Alert variant="info">
              <LoaderCircleIcon className="size-4 animate-spin" />
              <AlertDescription>Testing Supermemory connection...</AlertDescription>
            </Alert>
          ) : testConnection.status === "success" ? (
            <Alert variant="success">
              <CheckCircle2Icon className="size-4" />
              <AlertDescription>{testConnection.message}</AlertDescription>
            </Alert>
          ) : testConnection.status === "error" ? (
            <Alert variant="error">
              <AlertDescription>{testConnection.message}</AlertDescription>
            </Alert>
          ) : null}
          {status.auth.lastError && testConnection.status === "idle" ? (
            <p className="rounded-lg bg-warning/8 px-3 py-2 text-xs text-warning-foreground">
              {status.auth.lastError}
            </p>
          ) : null}
          {editingProviders ? (
            <div className="space-y-3">
              <ProviderBillingNote />
              <SupermemoryProviderSelector
                onChange={setSelectedIds}
                providers={status.providers}
                selected={selectedIds}
              />
              <div className="flex justify-end">
                <Button
                  disabled={busy !== null}
                  onClick={() =>
                    runAction("providers", () =>
                      ensureLocalApi().server.configureMemory({
                        providerInstanceIds: [...selectedIds],
                      }),
                    )
                  }
                  size="sm"
                >
                  Save providers
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              nativeInput
              onChange={(event) => setRotatedKey(event.currentTarget.value)}
              placeholder="New Supermemory API key"
              type="password"
              value={rotatedKey}
            />
            <Button
              disabled={busy !== null || rotatedKey.trim().length === 0}
              onClick={() =>
                runAction("rotate", async () => {
                  const next = await ensureLocalApi().server.configureMemory({
                    apiKey: rotatedKey.trim(),
                    providerInstanceIds: status.providers
                      .filter((provider) => provider.selected)
                      .map((provider) => provider.instanceId),
                  });
                  setRotatedKey("");
                  return next;
                })
              }
              variant="outline"
            >
              <KeyRoundIcon className="size-4" />
              Rotate key
            </Button>
          </div>
        </div>
        <div className="divide-y border-t">
          {status.providers.map((provider) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3"
              key={provider.instanceId}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{provider.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {provider.instanceId} · {provider.driver}
                  {provider.message ? ` · ${provider.message}` : ""}
                </div>
              </div>
              <Badge size="sm" variant={statusBadgeVariant(provider.status)}>
                {statusLabel(provider.status)}
              </Badge>
            </div>
          ))}
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
