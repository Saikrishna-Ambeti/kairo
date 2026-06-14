import {
  AppWindowIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  RefreshCwIcon,
  SearchIcon,
  TerminalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  ProviderDriverKind as ProviderDriverKindSchema,
  type ProviderDriverKind,
  type ProviderInstanceId,
  type ServerProvider,
  type SupermemoryProviderStatus,
  type SupermemoryStatus,
  type ComposioOperationProgressEvent,
  type ComposioStatus,
  type ComposioToolkitCatalog,
  type ComposioToolkitCatalogItem,
} from "@kairo/contracts";

import { ensureLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { useServerProviders } from "../../rpc/serverState";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ComposioSetupDialog } from "../settings/IntegrationsSettings";
import {
  getAvailableComposioCatalogItems,
  getConnectedComposioToolkits,
  getComposioPrimaryButtonState,
  type SetupMode,
} from "../settings/IntegrationsSettings.logic";
import { PROVIDER_CLIENT_DEFINITIONS } from "../settings/providerDriverMeta";

const CODING_AGENT_DRIVERS = new Set<ProviderDriverKind>([
  ProviderDriverKindSchema.make("codex"),
  ProviderDriverKindSchema.make("claudeAgent"),
  ProviderDriverKindSchema.make("opencode"),
]);

const MEMORY_AGENT_DRIVERS = CODING_AGENT_DRIVERS;
const SUPERMEMORY_CONSOLE_URL = "https://app.supermemory.ai/?view=integrations";

type StepKey = "agents" | "memory" | "composio" | "finish";
type BusyAction =
  | "refresh"
  | "install-agent"
  | "save-memory"
  | "setup-composio"
  | "connect-app"
  | null;

interface AgentOption {
  readonly definition: (typeof PROVIDER_CLIENT_DEFINITIONS)[number];
  readonly provider: ServerProvider | undefined;
}

function showOnboardingError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function statusText(value: string): string {
  return value.replace(/_/g, " ");
}

function agentBadgeVariant(provider: ServerProvider | undefined) {
  if (!provider) return "outline";
  if (!provider.enabled) return "outline";
  if (provider.installed && provider.auth.status === "authenticated") return "success";
  if (provider.installed) return "warning";
  if (provider.status === "error") return "error";
  return "outline";
}

function agentStatusLabel(provider: ServerProvider | undefined): string {
  if (!provider) return "Not configured";
  if (!provider.enabled) return "Disabled";
  if (!provider.installed) return "Not installed";
  if (provider.auth.status === "authenticated") return "Ready";
  if (provider.auth.status === "unauthenticated") return "Needs login";
  return statusText(provider.status);
}

function memoryProviderBadgeVariant(status: SupermemoryProviderStatus["status"]) {
  switch (status) {
    case "ready":
      return "success";
    case "needs_install":
    case "needs_action":
      return "warning";
    case "error":
    case "unsupported":
      return "error";
    default:
      return "outline";
  }
}

function connectedAppLabel(item: ComposioToolkitCatalogItem): string {
  return item.label.trim() || item.toolkit;
}

function StepRail({
  activeStep,
  completed,
}: {
  activeStep: StepKey;
  completed: ReadonlySet<StepKey>;
}) {
  const steps: ReadonlyArray<{ key: StepKey; label: string; icon: ElementType }> = [
    { key: "agents", label: "Agents", icon: TerminalIcon },
    { key: "memory", label: "Memory", icon: BrainCircuitIcon },
    { key: "composio", label: "Composio", icon: PlugZapIcon },
    { key: "finish", label: "Finish", icon: CheckCircle2Icon },
  ];

  return (
    <nav className="grid gap-2 sm:grid-cols-4" aria-label="Onboarding steps">
      {steps.map((step) => {
        const Icon = step.icon;
        const done = completed.has(step.key);
        const active = activeStep === step.key;
        return (
          <div
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              active && "border-primary/50 bg-primary/8 text-foreground",
              done && !active && "border-success/25 bg-success/8 text-success-foreground",
              !active && !done && "border-border bg-background/50 text-muted-foreground",
            )}
            key={step.key}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md border",
                done ? "border-success/30 bg-success/10" : "border-current/20",
              )}
            >
              {done ? <CheckCircle2Icon className="size-3.5" /> : <Icon className="size-3.5" />}
            </span>
            <span className="truncate font-medium">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

function ProviderLogo({ option }: { option: AgentOption }) {
  const Icon = option.definition.icon;
  return (
    <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
      <Icon className="size-5" />
    </span>
  );
}

function AgentStep({
  options,
  installedAgents,
  busy,
  onInstall,
  onRefresh,
  onContinue,
}: {
  options: ReadonlyArray<AgentOption>;
  installedAgents: ReadonlyArray<ServerProvider>;
  busy: BusyAction;
  onInstall: (option: AgentOption) => void;
  onRefresh: () => void;
  onContinue: () => void;
}) {
  const hasInstalledAgent = installedAgents.length > 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Coding agent</h2>
          <p className="text-sm text-muted-foreground">
            Kairo checks for supported local CLIs before creating sessions.
          </p>
        </div>
        <div className="grid gap-3">
          {options.map((option) => {
            const provider = option.provider;
            const canInstall = Boolean(provider?.versionAdvisory?.canUpdate);
            const installed = Boolean(provider?.installed && provider.enabled);
            return (
              <div
                className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                key={option.definition.value}
              >
                <ProviderLogo option={option} />
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {option.definition.label}
                    </span>
                    <Badge size="sm" variant={agentBadgeVariant(provider)}>
                      {agentStatusLabel(provider)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {provider?.versionAdvisory?.updateCommand ??
                      provider?.message ??
                      "Install the CLI and refresh detection."}
                  </p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  {installed ? (
                    <Button size="sm" variant="outline" disabled>
                      <CheckCircle2Icon className="size-3.5" />
                      Detected
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canInstall || busy !== null}
                      onClick={() => onInstall(option)}
                    >
                      {busy === "install-agent" ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <TerminalIcon className="size-3.5" />
                      )}
                      Install
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <aside className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AppWindowIcon className="size-4 text-muted-foreground" />
          Detection
        </div>
        {hasInstalledAgent ? (
          <div className="space-y-2 text-sm">
            {installedAgents.map((provider) => (
              <div className="flex items-center justify-between gap-3" key={provider.instanceId}>
                <span className="truncate">{provider.displayName ?? provider.instanceId}</span>
                <Badge size="sm" variant="success">
                  Ready
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            No supported coding agent was detected on this device.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={onRefresh}>
            {busy === "refresh" ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            Refresh
          </Button>
          <Button size="sm" disabled={!hasInstalledAgent || busy !== null} onClick={onContinue}>
            Continue
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </aside>
    </div>
  );
}

function MemoryProviderSelector({
  providers,
  selected,
  onChange,
}: {
  providers: ReadonlyArray<SupermemoryProviderStatus>;
  selected: ReadonlySet<ProviderInstanceId>;
  onChange: (next: ReadonlySet<ProviderInstanceId>) => void;
}) {
  return (
    <div className="divide-y rounded-lg border bg-card">
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
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(provider.instanceId);
                else next.delete(provider.instanceId);
                onChange(next);
              }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{provider.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {provider.message ?? provider.driver}
              </span>
            </span>
            <Badge size="sm" variant={memoryProviderBadgeVariant(provider.status)}>
              {statusText(provider.status)}
            </Badge>
          </label>
        );
      })}
    </div>
  );
}

function MemoryStep({
  status,
  providers,
  selectedProviderIds,
  apiKey,
  busy,
  onApiKeyChange,
  onProviderSelectionChange,
  onSave,
  onContinue,
}: {
  status: SupermemoryStatus | null;
  providers: ReadonlyArray<SupermemoryProviderStatus>;
  selectedProviderIds: ReadonlySet<ProviderInstanceId>;
  apiKey: string;
  busy: BusyAction;
  onApiKeyChange: (value: string) => void;
  onProviderSelectionChange: (next: ReadonlySet<ProviderInstanceId>) => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  const configured = Boolean(status?.enabled && status.auth.hasApiKey);
  const canSave = apiKey.trim().length > 0 && selectedProviderIds.size > 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Memory</h2>
          <p className="text-sm text-muted-foreground">
            Supermemory stores long-running agent context behind your API key.
          </p>
        </div>
        <div className="grid gap-4 rounded-lg border bg-card p-4">
          <div className="grid gap-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="onboarding-sm-key"
            >
              Supermemory API key
            </label>
            <Input
              id="onboarding-sm-key"
              nativeInput
              type="password"
              placeholder={configured ? "API key saved" : "sm_..."}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium text-muted-foreground">Agent access</div>
            <MemoryProviderSelector
              providers={providers}
              selected={selectedProviderIds}
              onChange={onProviderSelectionChange}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {configured ? (
              <Button variant="outline" disabled={busy !== null} onClick={onContinue}>
                Continue
                <ArrowRightIcon className="size-3.5" />
              </Button>
            ) : null}
            <Button disabled={!canSave || busy !== null} onClick={onSave}>
              {busy === "save-memory" ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <KeyRoundIcon className="size-4" />
              )}
              Save key
            </Button>
          </div>
        </div>
      </section>
      <aside className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <BrainCircuitIcon className="size-4 text-muted-foreground" />
          API key
        </div>
        <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
          <li>Open the Supermemory Personal App</li>
          <li>Go to API Keys, then create a new key.</li>
          <li>Copy the key and save it here.</li>
        </ol>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void ensureLocalApi().shell.openExternal(SUPERMEMORY_CONSOLE_URL)}
        >
          <ExternalLinkIcon className="size-3.5" />
          Open console
        </Button>
      </aside>
    </div>
  );
}

function CatalogAppRow({
  item,
  connecting,
  disabled,
  onConnect,
}: {
  item: ComposioToolkitCatalogItem;
  connecting: boolean;
  disabled: boolean;
  onConnect: (toolkit: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t px-4 py-3 first:border-t-0">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {item.logoUrl ? (
            <img alt="" className="size-5 rounded-sm object-contain" src={item.logoUrl} />
          ) : null}
          <span className="truncate text-sm font-semibold">{connectedAppLabel(item)}</span>
          <Badge size="sm" variant="outline">
            {item.toolkit}
          </Badge>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.description ?? "Connect this app through Composio."}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onConnect(item.toolkit)}
      >
        {connecting ? (
          <LoaderCircleIcon className="size-3.5 animate-spin" />
        ) : (
          <PlugZapIcon className="size-3.5" />
        )}
        Connect
      </Button>
    </div>
  );
}

function ComposioStep({
  status,
  catalog,
  query,
  busy,
  connectingToolkit,
  catalogLoading,
  onQueryChange,
  onRunSetup,
  onLoadCatalog,
  onConnectToolkit,
  onContinue,
}: {
  status: ComposioStatus | null;
  catalog: ComposioToolkitCatalog | null;
  query: string;
  busy: BusyAction;
  connectingToolkit: string | null;
  catalogLoading: boolean;
  onQueryChange: (value: string) => void;
  onRunSetup: (mode: SetupMode) => void;
  onLoadCatalog: () => void;
  onConnectToolkit: (toolkit: string) => void;
  onContinue: () => void;
}) {
  const primaryAction = status?.primaryAction ?? "install_and_login";
  const operationRunning = status?.operation?.status === "running";
  const primaryButton = getComposioPrimaryButtonState({
    primaryAction,
    busy: busy === "setup-composio",
    operationRunning,
  });
  const authenticated = status?.auth.status === "authenticated";
  const connectedToolkits = getConnectedComposioToolkits(status);
  const availableApps = getAvailableComposioCatalogItems(catalog?.items ?? [], status, query).slice(
    0,
    12,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Composio</h2>
          <p className="text-sm text-muted-foreground">
            Composio lets agents connect to external apps from this device.
          </p>
        </div>
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <TerminalIcon className="size-4 text-muted-foreground" />
                <span className="truncate text-sm font-semibold">Composio CLI</span>
                <Badge
                  size="sm"
                  variant={
                    authenticated ? "success" : primaryAction === "none" ? "outline" : "warning"
                  }
                >
                  {authenticated ? "Authenticated" : statusText(status?.cli.status ?? "checking")}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {status?.cli.executablePath ?? status?.cli.message ?? "Checking local CLI status."}
              </p>
            </div>
            {primaryAction !== "none" ? (
              <Button
                disabled={primaryButton.disabled || busy !== null}
                onClick={() => onRunSetup(primaryAction)}
              >
                {busy === "setup-composio" || operationRunning ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <PlugZapIcon className="size-4" />
                )}
                {operationRunning ? primaryButton.runningLabel : primaryButton.label}
              </Button>
            ) : (
              <Button disabled={!authenticated || busy !== null} onClick={onContinue}>
                Continue
                <ArrowRightIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {authenticated ? (
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Connected apps</h3>
                <p className="text-xs text-muted-foreground">
                  Apps can also be added later from Settings, then Integrations.
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={onLoadCatalog}>
                {catalogLoading ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : (
                  <PlugZapIcon className="size-3.5" />
                )}
                Connect new apps
              </Button>
            </div>
            {connectedToolkits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {connectedToolkits.map((toolkit) => (
                  <Badge key={toolkit.toolkit} variant="success">
                    {toolkit.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No connected apps detected yet.</p>
            )}
            {catalog ? (
              <div className="space-y-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    nativeInput
                    className="pl-9"
                    placeholder="Search apps"
                    value={query}
                    onChange={(event) => onQueryChange(event.currentTarget.value)}
                  />
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border">
                  {availableApps.length > 0 ? (
                    availableApps.map((item) => (
                      <CatalogAppRow
                        key={item.toolkit}
                        item={item}
                        disabled={busy !== null}
                        connecting={connectingToolkit === item.toolkit}
                        onConnect={onConnectToolkit}
                      />
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-muted-foreground">No apps found.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      <aside className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PlugZapIcon className="size-4 text-muted-foreground" />
          Agent access
        </div>
        {(status?.agentSupport ?? []).length > 0 ? (
          <div className="space-y-2">
            {status?.agentSupport.map((entry) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm"
                key={entry.providerInstanceId}
              >
                <span className="truncate">{entry.displayName}</span>
                <Badge size="sm" variant={entry.selected ? "success" : "outline"}>
                  {entry.selected ? "Enabled" : statusText(entry.skillStatus)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Agent access will be installed for the detected providers during setup.
          </p>
        )}
      </aside>
    </div>
  );
}

function FinishStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-5 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-xl border bg-success/10 text-success-foreground">
        <CheckCircle2Icon className="size-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Setup complete</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Your coding agent, memory, and Composio integrations are ready on this device.
        </p>
      </div>
      <div className="flex justify-center">
        <Button onClick={onComplete}>
          Open Kairo
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function OnboardingGate({ onComplete }: { onComplete: () => void }) {
  const serverProviders = useServerProviders();
  const [providersOverride, setProvidersOverride] = useState<ReadonlyArray<ServerProvider> | null>(
    null,
  );
  const providers = providersOverride ?? serverProviders;
  const [memoryStatus, setMemoryStatus] = useState<SupermemoryStatus | null>(null);
  const [composioStatus, setComposioStatus] = useState<ComposioStatus | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("agents");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [memoryApiKey, setMemoryApiKey] = useState("");
  const [selectedMemoryProviderIds, setSelectedMemoryProviderIds] = useState<
    ReadonlySet<ProviderInstanceId>
  >(new Set());
  const [setupMode, setSetupMode] = useState<SetupMode>("install_and_login");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [events, setEvents] = useState<ComposioOperationProgressEvent[]>([]);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ComposioToolkitCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null);
  const didInitialLoadRef = useRef(false);

  const agentOptions = useMemo<ReadonlyArray<AgentOption>>(
    () =>
      PROVIDER_CLIENT_DEFINITIONS.filter((definition) =>
        CODING_AGENT_DRIVERS.has(definition.value),
      ).map((definition) => ({
        definition,
        provider: providers.find((provider) => provider.driver === definition.value),
      })),
    [providers],
  );

  const installedAgents = useMemo(
    () =>
      providers.filter(
        (provider) =>
          CODING_AGENT_DRIVERS.has(provider.driver) &&
          provider.enabled &&
          provider.installed &&
          provider.availability !== "unavailable",
      ),
    [providers],
  );

  const memoryProviders = useMemo<ReadonlyArray<SupermemoryProviderStatus>>(() => {
    if (memoryStatus?.providers.length) return memoryStatus.providers;
    return installedAgents.map((provider) => ({
      instanceId: provider.instanceId,
      driver: provider.driver,
      displayName: provider.displayName ?? String(provider.instanceId),
      selected: true,
      supported: MEMORY_AGENT_DRIVERS.has(provider.driver),
      status: MEMORY_AGENT_DRIVERS.has(provider.driver) ? "not_selected" : "unsupported",
    }));
  }, [installedAgents, memoryStatus?.providers]);

  const selectedComposioProviderIds = useMemo(
    () =>
      composioStatus?.agentSupport
        .filter((entry) => entry.selected)
        .map((entry) => entry.providerInstanceId) ??
      installedAgents.map((provider) => provider.instanceId),
    [composioStatus?.agentSupport, installedAgents],
  );

  const agentComplete = installedAgents.length > 0;
  const memoryComplete = Boolean(memoryStatus?.enabled && memoryStatus.auth.hasApiKey);
  const composioComplete = composioStatus?.auth.status === "authenticated";
  const completed = useMemo(() => {
    const next = new Set<StepKey>();
    if (agentComplete) next.add("agents");
    if (memoryComplete) next.add("memory");
    if (composioComplete) next.add("composio");
    if (agentComplete && memoryComplete && composioComplete) next.add("finish");
    return next;
  }, [agentComplete, composioComplete, memoryComplete]);

  const refreshAll = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    try {
      const localApi = ensureLocalApi();
      const [providerPayload, nextMemory, nextComposio] = await Promise.all([
        localApi.server.refreshProviders(),
        localApi.server.getMemoryStatus(),
        localApi.server.getComposioStatus(),
      ]);
      setProvidersOverride(providerPayload.providers);
      setMemoryStatus(nextMemory);
      setComposioStatus(nextComposio);
      return { providers: providerPayload.providers, memory: nextMemory, composio: nextComposio };
    } finally {
      setBusy((current) => (current === "refresh" ? null : current));
    }
  }, []);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    setLoading(true);
    void refreshAll()
      .catch((error) => showOnboardingError("Setup status unavailable", error))
      .finally(() => setLoading(false));
  }, [refreshAll]);

  useEffect(() => {
    if (selectedMemoryProviderIds.size > 0 || memoryProviders.length === 0) return;
    const selected = memoryProviders.filter((provider) =>
      memoryStatus?.enabled
        ? provider.selected
        : provider.supported &&
          installedAgents.some((agent) => agent.instanceId === provider.instanceId),
    );
    setSelectedMemoryProviderIds(new Set(selected.map((provider) => provider.instanceId)));
  }, [installedAgents, memoryProviders, memoryStatus?.enabled, selectedMemoryProviderIds.size]);

  useEffect(() => {
    if (activeStep === "agents" && agentComplete) setActiveStep("memory");
    if (activeStep === "memory" && memoryComplete) setActiveStep("composio");
    if (activeStep === "composio" && composioComplete) setActiveStep("finish");
  }, [activeStep, agentComplete, composioComplete, memoryComplete]);

  const installAgent = async (option: AgentOption) => {
    const provider = option.provider;
    if (!provider) return;
    setBusy("install-agent");
    try {
      const next = await ensureLocalApi().server.updateProvider({
        provider: provider.driver,
        instanceId: provider.instanceId,
      });
      setProvidersOverride(next.providers);
      await refreshAll();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: `${option.definition.label} install command finished`,
        }),
      );
    } catch (error) {
      showOnboardingError(`Could not install ${option.definition.label}`, error);
    } finally {
      setBusy(null);
    }
  };

  const saveMemory = async () => {
    const trimmedApiKey = memoryApiKey.trim();
    if (!trimmedApiKey || selectedMemoryProviderIds.size === 0) return;
    setBusy("save-memory");
    try {
      const next = await ensureLocalApi().server.configureMemory({
        apiKey: trimmedApiKey,
        providerInstanceIds: [...selectedMemoryProviderIds],
      });
      setMemoryStatus(next);
      setMemoryApiKey("");
      setActiveStep("composio");
      toastManager.add(stackedThreadToast({ type: "success", title: "Memory configured" }));
    } catch (error) {
      showOnboardingError("Memory setup failed", error);
    } finally {
      setBusy(null);
    }
  };

  const appendComposioProgress = (event: ComposioOperationProgressEvent) => {
    setEvents((previous) => [...previous, event].slice(-80));
    if (event.authUrl) setAuthUrl(event.authUrl);
    setComposioStatus((previous) =>
      previous
        ? {
            ...previous,
            operation: event.operation,
          }
        : previous,
    );
  };

  const runComposioSetup = async (mode: SetupMode) => {
    setSetupMode(mode);
    setEvents([]);
    setAuthUrl(null);
    setDialogOpen(true);
    setBusy("setup-composio");
    try {
      const input = { providerInstanceIds: selectedComposioProviderIds };
      const next =
        mode === "install_and_login"
          ? await ensureLocalApi().server.installAndLoginComposio(input, appendComposioProgress)
          : await ensureLocalApi().server.loginComposio(input, appendComposioProgress);
      setComposioStatus(next);
      if (next.auth.status === "authenticated") {
        setActiveStep("finish");
        toastManager.add(stackedThreadToast({ type: "success", title: "Composio ready" }));
      }
    } catch (error) {
      showOnboardingError("Composio setup failed", error);
      void refreshAll().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const next = await ensureLocalApi().server.listComposioToolkits({ limit: 1000 });
      setCatalog(next);
    } catch (error) {
      showOnboardingError("Could not load Composio apps", error);
    } finally {
      setCatalogLoading(false);
    }
  };

  const connectToolkit = async (toolkit: string) => {
    setConnectingToolkit(toolkit);
    setBusy("connect-app");
    setSetupMode("login");
    setEvents([]);
    setAuthUrl(null);
    setDialogOpen(true);
    try {
      const next = await ensureLocalApi().server.linkComposioToolkit(
        { toolkit },
        appendComposioProgress,
      );
      setComposioStatus(next);
      toastManager.add(stackedThreadToast({ type: "success", title: `${toolkit} connected` }));
    } catch (error) {
      showOnboardingError(`Could not connect ${toolkit}`, error);
    } finally {
      setConnectingToolkit(null);
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
        Checking setup
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Device setup
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Set up Kairo</h1>
          </div>
          <StepRail activeStep={activeStep} completed={completed} />
        </header>

        <main className="rounded-xl border bg-background/75 p-4 shadow-sm sm:p-5">
          {activeStep === "agents" ? (
            <AgentStep
              options={agentOptions}
              installedAgents={installedAgents}
              busy={busy}
              onInstall={(option) => void installAgent(option)}
              onRefresh={() =>
                void refreshAll().catch((error) => showOnboardingError("Refresh failed", error))
              }
              onContinue={() => setActiveStep("memory")}
            />
          ) : activeStep === "memory" ? (
            <MemoryStep
              status={memoryStatus}
              providers={memoryProviders}
              selectedProviderIds={selectedMemoryProviderIds}
              apiKey={memoryApiKey}
              busy={busy}
              onApiKeyChange={setMemoryApiKey}
              onProviderSelectionChange={setSelectedMemoryProviderIds}
              onSave={() => void saveMemory()}
              onContinue={() => setActiveStep("composio")}
            />
          ) : activeStep === "composio" ? (
            <ComposioStep
              status={composioStatus}
              catalog={catalog}
              query={catalogQuery}
              busy={busy}
              connectingToolkit={connectingToolkit}
              catalogLoading={catalogLoading}
              onQueryChange={setCatalogQuery}
              onRunSetup={(mode) => void runComposioSetup(mode)}
              onLoadCatalog={() => void loadCatalog()}
              onConnectToolkit={(toolkit) => void connectToolkit(toolkit)}
              onContinue={() => setActiveStep("finish")}
            />
          ) : (
            <FinishStep onComplete={onComplete} />
          )}
        </main>
      </div>

      <ComposioSetupDialog
        open={dialogOpen}
        mode={setupMode}
        events={events}
        authUrl={authUrl}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
