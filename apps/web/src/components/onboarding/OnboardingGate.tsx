import {
  AppWindowIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CloudIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlugZapIcon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  type ProviderInstanceId,
  type ServerProvider,
  type SupermemoryProviderStatus,
  type SupermemoryStatus,
  type ComposioStatus,
} from "@kairo/contracts";

import { ensureLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { useServerProviders } from "../../rpc/serverState";
import { usePrimaryServerApi } from "../../state/primaryServerApi";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { PROVIDER_CLIENT_DEFINITIONS } from "../settings/providerDriverMeta";
import {
  ONBOARDING_CODING_AGENT_DRIVERS,
  findOnboardingProvider,
  getOnboardingAgentAction,
  getOnboardingAgentDescription,
  getOnboardingAgentProgressLabel,
  isUsableOnboardingAgent,
  resolveOnboardingAgentInstallOutcome,
  resolveOnboardingAgentReadiness,
} from "./OnboardingGate.logic";

const MEMORY_AGENT_DRIVERS = ONBOARDING_CODING_AGENT_DRIVERS;
const SUPERMEMORY_CONSOLE_URL = "https://app.supermemory.ai/?view=integrations";
const COMPOSIO_DASHBOARD_URL = "https://dashboard.composio.dev";

type StepKey = "agents" | "memory" | "composio" | "finish";
type BusyAction =
  | "refresh"
  | "install-agent"
  | "login-agent"
  | "save-memory"
  | "setup-composio"
  | null;

interface AgentOption {
  readonly definition: (typeof PROVIDER_CLIENT_DEFINITIONS)[number];
  readonly provider: ServerProvider | undefined;
}

const ONBOARDING_STEPS: ReadonlyArray<{ key: StepKey; label: string; icon: ElementType }> = [
  { key: "agents", label: "Agents", icon: TerminalIcon },
  { key: "memory", label: "Memory", icon: BrainCircuitIcon },
  { key: "composio", label: "Composio", icon: PlugZapIcon },
  { key: "finish", label: "Finish", icon: CheckCircle2Icon },
];

function onboardingStepIndex(step: StepKey): number {
  return ONBOARDING_STEPS.findIndex((candidate) => candidate.key === step);
}

export function canNavigateBackToOnboardingStep(activeStep: StepKey, targetStep: StepKey): boolean {
  return onboardingStepIndex(targetStep) < onboardingStepIndex(activeStep);
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
  if (isUsableOnboardingAgent(provider)) return "success";
  if (provider.status === "error") return "error";
  if (provider.installed) return "warning";
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

function StepRail({
  activeStep,
  completed,
  onStepSelect,
}: {
  activeStep: StepKey;
  completed: ReadonlySet<StepKey>;
  onStepSelect: (step: StepKey) => void;
}) {
  return (
    <nav className="grid gap-2 sm:grid-cols-4" aria-label="Onboarding steps">
      {ONBOARDING_STEPS.map((step) => {
        const Icon = step.icon;
        const done = completed.has(step.key);
        const active = activeStep === step.key;
        const canGoBack = canNavigateBackToOnboardingStep(activeStep, step.key);
        const className = cn(
          "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors",
          active && "border-primary/50 bg-primary/8 text-foreground",
          done && !active && "border-success/25 bg-success/8 text-success-foreground",
          !active && !done && "border-border bg-background/50 text-muted-foreground",
          canGoBack &&
            "cursor-pointer hover:border-primary/35 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        );
        const content = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md border",
                done ? "border-success/30 bg-success/10" : "border-current/20",
              )}
            >
              {done ? <CheckCircle2Icon className="size-3.5" /> : <Icon className="size-3.5" />}
            </span>
            <span className="truncate font-medium">{step.label}</span>
          </>
        );

        if (canGoBack) {
          return (
            <button
              aria-label={`Go back to ${step.label}`}
              className={className}
              key={step.key}
              onClick={() => onStepSelect(step.key)}
              type="button"
            >
              {content}
            </button>
          );
        }

        return (
          <div aria-current={active ? "step" : undefined} className={className} key={step.key}>
            {content}
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
  usableAgents,
  busy,
  busyProviderInstanceId,
  onInstall,
  onLogin,
  onRefresh,
  onContinue,
}: {
  options: ReadonlyArray<AgentOption>;
  usableAgents: ReadonlyArray<ServerProvider>;
  busy: BusyAction;
  busyProviderInstanceId: ProviderInstanceId | null;
  onInstall: (option: AgentOption) => void;
  onLogin: (option: AgentOption) => void;
  onRefresh: () => void;
  onContinue: () => void;
}) {
  const hasUsableAgent = usableAgents.length > 0;
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
            const action = getOnboardingAgentAction(provider);
            const targetBusy =
              provider && busyProviderInstanceId === provider.instanceId ? busy : null;
            const progressLabel = getOnboardingAgentProgressLabel(
              provider,
              targetBusy === "install-agent",
              option.definition.label,
            );
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
                  <p
                    className={cn(
                      "text-xs leading-5 text-muted-foreground",
                      !progressLabel && "sm:line-clamp-2",
                    )}
                  >
                    {getOnboardingAgentDescription(provider)}
                  </p>
                  {progressLabel ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span aria-live="polite" className="font-medium text-foreground">
                          {progressLabel}
                        </span>
                        <span className="text-muted-foreground">Keep Kairo open</span>
                      </div>
                      <progress
                        aria-label={`${option.definition.label} installation progress`}
                        className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  {action === "detected" ? (
                    <Button size="sm" variant="outline" disabled>
                      <CheckCircle2Icon className="size-3.5" />
                      Detected
                    </Button>
                  ) : action === "login" ? (
                    <Button size="sm" disabled={busy !== null} onClick={() => onLogin(option)}>
                      {targetBusy === "login-agent" ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <KeyRoundIcon className="size-3.5" />
                      )}
                      Login
                    </Button>
                  ) : action === "refresh" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={onRefresh}
                    >
                      {busy === "refresh" ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="size-3.5" />
                      )}
                      Refresh
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canInstall || busy !== null}
                      onClick={() => onInstall(option)}
                    >
                      {targetBusy === "install-agent" ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <TerminalIcon className="size-3.5" />
                      )}
                      {provider?.updateState?.status === "failed" ||
                      provider?.updateState?.status === "unchanged"
                        ? "Retry install"
                        : "Install"}
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
        {hasUsableAgent ? (
          <div className="space-y-2 text-sm">
            {usableAgents.map((provider) => (
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
          <Button size="sm" disabled={!hasUsableAgent || busy !== null} onClick={onContinue}>
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

function ComposioStep({
  status,
  apiKey,
  selectedProviderIds,
  busy,
  onApiKeyChange,
  onProviderSelectionChange,
  onSave,
  onContinue,
}: {
  status: ComposioStatus | null;
  apiKey: string;
  selectedProviderIds: ReadonlySet<ProviderInstanceId>;
  busy: BusyAction;
  onApiKeyChange: (value: string) => void;
  onProviderSelectionChange: (next: ReadonlySet<ProviderInstanceId>) => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  const configured = status?.auth.status === "configured";
  const canSave =
    busy === null &&
    selectedProviderIds.size > 0 &&
    (status?.auth.hasApiKey === true || apiKey.trim().length > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Composio</h2>
          <p className="text-sm text-muted-foreground">
            Connect agents to hosted app tools without installing another runtime.
          </p>
        </div>
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <CloudIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Composio Connect</span>
            <Badge size="sm" variant={configured ? "success" : "outline"}>
              {configured ? "Connected" : "Needs API key"}
            </Badge>
          </div>
          <Input
            nativeInput
            type="password"
            autoComplete="off"
            placeholder={
              status?.auth.hasApiKey
                ? "Saved. Enter a new key to replace it."
                : "Paste your x-consumer-api-key"
            }
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.currentTarget.value)}
          />
          {status?.auth.lastError ? (
            <p className="text-xs text-destructive">{status.auth.lastError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Key stays in this environment's secret store. New agent sessions receive hosted MCP
              access.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canSave} onClick={onSave}>
              {busy === "setup-composio" ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <PlugZapIcon className="size-4" />
              )}
              Save and test
            </Button>
            {configured ? (
              <Button variant="outline" disabled={busy !== null} onClick={onContinue}>
                Continue
                <ArrowRightIcon className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      <aside className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PlugZapIcon className="size-4 text-muted-foreground" />
          Agent access
        </div>
        {(status?.agentSupport ?? []).length > 0 ? (
          <div className="space-y-2">
            {status?.agentSupport.map((entry) => (
              <label
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-sm"
                key={entry.providerInstanceId}
              >
                <Checkbox
                  checked={selectedProviderIds.has(entry.providerInstanceId)}
                  disabled={!entry.supported || busy !== null}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedProviderIds);
                    if (checked) next.add(entry.providerInstanceId);
                    else next.delete(entry.providerInstanceId);
                    onProviderSelectionChange(next);
                  }}
                />
                <span className="truncate">{entry.displayName}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Select a supported agent after installing it.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void ensureLocalApi().shell.openExternal(COMPOSIO_DASHBOARD_URL)}
        >
          <ExternalLinkIcon className="size-3.5" />
          Get API key
        </Button>
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
          Your coding agent, memory, and hosted Composio tools are ready.
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
  const serverApi = usePrimaryServerApi();
  const serverProviders = useServerProviders();
  const providers = serverProviders;
  const [memoryStatus, setMemoryStatus] = useState<SupermemoryStatus | null>(null);
  const [composioStatus, setComposioStatus] = useState<ComposioStatus | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("agents");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [busyProviderInstanceId, setBusyProviderInstanceId] = useState<ProviderInstanceId | null>(
    null,
  );
  const [memoryApiKey, setMemoryApiKey] = useState("");
  const [selectedMemoryProviderIds, setSelectedMemoryProviderIds] = useState<
    ReadonlySet<ProviderInstanceId>
  >(new Set());
  const [composioApiKey, setComposioApiKey] = useState("");
  const [selectedComposioProviderIds, setSelectedComposioProviderIds] = useState<
    ReadonlySet<ProviderInstanceId>
  >(new Set());
  const didInitialLoadRef = useRef(false);
  const userSelectedStepRef = useRef(false);

  const agentOptions = useMemo<ReadonlyArray<AgentOption>>(
    () =>
      PROVIDER_CLIENT_DEFINITIONS.filter((definition) =>
        ONBOARDING_CODING_AGENT_DRIVERS.has(definition.value),
      ).map((definition) => ({
        definition,
        provider: providers.find((provider) => provider.driver === definition.value),
      })),
    [providers],
  );

  const usableAgents = useMemo(() => providers.filter(isUsableOnboardingAgent), [providers]);

  const memoryProviders = useMemo<ReadonlyArray<SupermemoryProviderStatus>>(() => {
    if (memoryStatus?.providers.length) return memoryStatus.providers;
    return usableAgents.map((provider) => ({
      instanceId: provider.instanceId,
      driver: provider.driver,
      displayName: provider.displayName ?? String(provider.instanceId),
      selected: true,
      supported: MEMORY_AGENT_DRIVERS.has(provider.driver),
      status: MEMORY_AGENT_DRIVERS.has(provider.driver) ? "not_selected" : "unsupported",
    }));
  }, [usableAgents, memoryStatus?.providers]);

  const agentComplete = usableAgents.length > 0;
  const memoryComplete = Boolean(memoryStatus?.enabled && memoryStatus.auth.hasApiKey);
  const composioComplete = Boolean(
    composioStatus?.enabled && composioStatus.auth.status === "configured",
  );
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
      const [providerPayload, nextMemory, nextComposio] = await Promise.all([
        serverApi.refreshProviders(),
        serverApi.getMemoryStatus(),
        serverApi.getComposioStatus(),
      ]);
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
          usableAgents.some((agent) => agent.instanceId === provider.instanceId),
    );
    setSelectedMemoryProviderIds(new Set(selected.map((provider) => provider.instanceId)));
  }, [usableAgents, memoryProviders, memoryStatus?.enabled, selectedMemoryProviderIds.size]);

  useEffect(() => {
    if (selectedComposioProviderIds.size > 0 || !composioStatus?.agentSupport.length) return;
    const selected = composioStatus.agentSupport.filter((provider) =>
      composioStatus.enabled
        ? provider.selected
        : provider.supported &&
          usableAgents.some((agent) => agent.instanceId === provider.providerInstanceId),
    );
    setSelectedComposioProviderIds(
      new Set(selected.map((provider) => provider.providerInstanceId)),
    );
  }, [
    composioStatus?.agentSupport,
    composioStatus?.enabled,
    selectedComposioProviderIds.size,
    usableAgents,
  ]);

  useEffect(() => {
    if (userSelectedStepRef.current) return;
    if (activeStep === "agents" && agentComplete) setActiveStep("memory");
    if (activeStep === "memory" && memoryComplete) setActiveStep("composio");
    if (activeStep === "composio" && composioComplete) setActiveStep("finish");
  }, [activeStep, agentComplete, composioComplete, memoryComplete]);

  const selectStep = (step: StepKey) => {
    if (!canNavigateBackToOnboardingStep(activeStep, step)) return;
    userSelectedStepRef.current = true;
    setActiveStep(step);
  };

  const installAgent = async (option: AgentOption) => {
    const provider = option.provider;
    if (!provider) return;
    setBusy("install-agent");
    setBusyProviderInstanceId(provider.instanceId);
    try {
      const next = await serverApi.updateProvider({
        provider: provider.driver,
        instanceId: provider.instanceId,
      });
      const commandProvider = findOnboardingProvider(next.providers, provider.instanceId);
      const refreshed = await refreshAll();
      const refreshedProvider = findOnboardingProvider(refreshed.providers, provider.instanceId);
      const outcome = resolveOnboardingAgentInstallOutcome(
        commandProvider?.updateState?.status === "failed" ||
          commandProvider?.updateState?.status === "unchanged"
          ? commandProvider
          : (refreshedProvider ?? commandProvider),
      );
      if (outcome.kind === "ready") {
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: `${option.definition.label} ready`,
          }),
        );
      } else if (outcome.kind === "failed" || outcome.kind === "missing") {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: `Could not install ${option.definition.label}`,
            description: outcome.description,
          }),
        );
      } else {
        toastManager.add(
          stackedThreadToast({
            type: "warning",
            title:
              outcome.kind === "needs_login"
                ? `${option.definition.label} installed. Sign in next.`
                : `${option.definition.label} needs attention`,
            description: outcome.description,
          }),
        );
      }
    } catch (error) {
      showOnboardingError(`Could not install ${option.definition.label}`, error);
    } finally {
      setBusy(null);
      setBusyProviderInstanceId(null);
    }
  };

  const loginAgent = async (option: AgentOption) => {
    const provider = option.provider;
    if (!provider) return;
    setBusy("login-agent");
    setBusyProviderInstanceId(provider.instanceId);
    try {
      const next = await serverApi.loginProvider({
        provider: provider.driver,
        instanceId: provider.instanceId,
      });
      const refreshed = await refreshAll();
      const refreshedProvider =
        findOnboardingProvider(refreshed.providers, provider.instanceId) ??
        findOnboardingProvider(next.providers, provider.instanceId);
      const outcome = resolveOnboardingAgentReadiness(refreshedProvider);
      toastManager.add(
        stackedThreadToast(
          outcome.kind === "ready"
            ? { type: "success", title: `${option.definition.label} ready` }
            : {
                type: "warning",
                title: `${option.definition.label} still needs attention`,
                description: outcome.description,
              },
        ),
      );
    } catch (error) {
      showOnboardingError(`Could not login ${option.definition.label}`, error);
    } finally {
      setBusy(null);
      setBusyProviderInstanceId(null);
    }
  };

  const saveMemory = async () => {
    const trimmedApiKey = memoryApiKey.trim();
    if (!trimmedApiKey || selectedMemoryProviderIds.size === 0) return;
    setBusy("save-memory");
    try {
      const next = await serverApi.configureMemory({
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

  const saveComposio = async () => {
    const trimmedApiKey = composioApiKey.trim();
    if (
      selectedComposioProviderIds.size === 0 ||
      (!trimmedApiKey && !composioStatus?.auth.hasApiKey)
    ) {
      return;
    }
    setBusy("setup-composio");
    try {
      await serverApi.configureComposio({
        ...(trimmedApiKey ? { apiKey: trimmedApiKey } : {}),
        providerInstanceIds: [...selectedComposioProviderIds],
      });
      const next = await serverApi.testComposioConnection(
        trimmedApiKey ? { apiKey: trimmedApiKey } : {},
      );
      setComposioStatus(next);
      setComposioApiKey("");
      if (next.auth.status !== "configured") {
        throw new Error(next.auth.lastError ?? "Composio rejected the API key.");
      }
      setActiveStep("finish");
      toastManager.add(stackedThreadToast({ type: "success", title: "Composio ready" }));
    } catch (error) {
      showOnboardingError("Composio setup failed", error);
      void refreshAll().catch(() => undefined);
    } finally {
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
          <StepRail activeStep={activeStep} completed={completed} onStepSelect={selectStep} />
        </header>

        <main className="rounded-xl border bg-background/75 p-4 shadow-sm sm:p-5">
          {activeStep === "agents" ? (
            <AgentStep
              options={agentOptions}
              usableAgents={usableAgents}
              busy={busy}
              busyProviderInstanceId={busyProviderInstanceId}
              onInstall={(option) => void installAgent(option)}
              onLogin={(option) => void loginAgent(option)}
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
              apiKey={composioApiKey}
              selectedProviderIds={selectedComposioProviderIds}
              busy={busy}
              onApiKeyChange={setComposioApiKey}
              onProviderSelectionChange={setSelectedComposioProviderIds}
              onSave={() => void saveComposio()}
              onContinue={() => setActiveStep("finish")}
            />
          ) : (
            <FinishStep onComplete={onComplete} />
          )}
        </main>
      </div>
    </div>
  );
}
