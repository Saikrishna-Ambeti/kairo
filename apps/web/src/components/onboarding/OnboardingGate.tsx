import { msg, T, useGT, useMessages } from "gt-react";
import { m, type MessageResolver } from "../../i18n/messages";
import { settlePromise, squashAtomCommandFailure } from "@kairo/client-runtime/state/runtime";
import { ensureLocalApi } from "../../localApi";
import { ClerkFailed, ClerkLoaded, ClerkLoading, useAuth, useClerk } from "@clerk/react";
import { type ProviderInstanceId, type ServerProvider } from "@kairo/contracts";
import {
  AppWindowIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LogInIcon,
  RefreshCwIcon,
  TerminalIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import { hasCloudIdentityConfig } from "../../cloud/publicConfig";
import { isElectron } from "../../env";
import { useClientSettings, updateClientSettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { useServerProviders } from "../../rpc/serverState";
import { usePrimaryServerApi } from "../../state/primaryServerApi";
import { resolveClerkSignInProps } from "../clerk/authRedirect";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { SupermemorySettingsPanel } from "../settings/SupermemorySettings";
import { ComposioSettingsPanel } from "../settings/ComposioSettings";
import { providerClients } from "../settings/providerDriverMeta";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ProfessionalRolePicker } from "./ProfessionalRolePicker";
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
import { isProfessionalRoleComplete, type ProfessionalRole } from "./professionalRole";

export type OnboardingStep = "sign-in" | "profession" | "setup" | "memory" | "apps";
type BusyAction = "refresh" | "install-agent" | "login-agent" | null;

interface AgentOption {
  readonly definition: (typeof providerClients.definitions)[number];
  readonly provider: ServerProvider | undefined;
}

const ONBOARDING_STEPS: ReadonlyArray<{
  readonly key: OnboardingStep;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { key: "sign-in", label: msg("Sign in"), icon: LogInIcon },
  { key: "profession", label: msg("Profession"), icon: UserRoundIcon },
  { key: "setup", label: msg("Provider"), icon: TerminalIcon },
  { key: "memory", label: msg("Memory"), icon: KeyRoundIcon },
  { key: "apps", label: msg("Connected apps"), icon: AppWindowIcon },
];

export function advanceOnboardingStep(step: OnboardingStep): OnboardingStep {
  if (step === "sign-in") return "profession";
  if (step === "profession") return "setup";
  if (step === "setup") return "memory";
  return "apps";
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
  if (!provider || !provider.enabled) return "outline";
  if (isUsableOnboardingAgent(provider)) return "success";
  if (provider.status === "error") return "error";
  if (provider.installed) return "warning";
  return "outline";
}

function agentStatusLabel(provider: ServerProvider | undefined, resolve: MessageResolver): string {
  if (!provider) return resolve(msg("Not configured"));
  if (!provider.enabled) return resolve(msg("Disabled"));
  if (!provider.installed) return resolve(msg("Not installed"));
  if (provider.auth.status === "authenticated") return resolve(msg("Ready"));
  if (provider.auth.status === "unauthenticated" || provider.auth.status === "unknown") {
    return resolve(msg("Needs login"));
  }
  return statusText(provider.status);
}

function OnboardingProgress({
  activeStep,
  onProfessionEdit,
}: {
  readonly activeStep: OnboardingStep;
  readonly onProfessionEdit?: (() => void) | undefined;
}) {
  const gt = useGT();
  const messages = useMessages();
  const activeIndex = ONBOARDING_STEPS.findIndex((step) => step.key === activeStep);

  return (
    <nav aria-label={gt("Onboarding progress")} className="grid gap-2 sm:grid-cols-5">
      {ONBOARDING_STEPS.map((step, index) => {
        const Icon = step.icon;
        const active = step.key === activeStep;
        const complete = index < activeIndex;
        const canEditProfession = step.key === "profession" && activeStep === "setup";
        const className = cn(
          "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors",
          active && "border-primary/45 bg-primary/8 text-foreground",
          complete && !active && "border-success/25 bg-success/8 text-success-foreground",
          !active && !complete && "border-border bg-background/55 text-muted-foreground",
          canEditProfession &&
            "cursor-pointer hover:border-primary/35 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        );
        const content = (
          <>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                complete ? "border-success/30 bg-success/10" : "border-current/20",
              )}
            >
              {complete ? <CheckCircle2Icon className="size-4" /> : <Icon className="size-4" />}
            </span>
            <span className="truncate font-medium">{messages(step.label)}</span>
          </>
        );

        return canEditProfession ? (
          <button key={step.key} type="button" className={className} onClick={onProfessionEdit}>
            {content}
          </button>
        ) : (
          <div key={step.key} aria-current={active ? "step" : undefined} className={className}>
            {content}
          </div>
        );
      })}
    </nav>
  );
}

function OnboardingFrame({
  activeStep,
  onProfessionEdit,
  children,
}: {
  readonly activeStep: OnboardingStep;
  readonly onProfessionEdit?: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <div className="h-dvh overflow-auto scrollbar-gutter-both bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <header className="space-y-4 rounded-xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              <T>Set up Kairo</T>
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              <T>Sign in, tell us how you work, then connect a coding agent.</T>
            </p>
          </div>
          <OnboardingProgress activeStep={activeStep} onProfessionEdit={onProfessionEdit} />
        </header>
        <main className="min-h-64 rounded-xl border border-border/80 bg-card p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SignInStep({
  loading,
  signedIn,
  onSignIn,
  onContinue,
}: {
  readonly loading: boolean;
  readonly signedIn: boolean;
  readonly onSignIn: () => void;
  readonly onContinue: () => void;
}) {
  const gt = useGT();
  if (!loading && !signedIn) {
    return (
      <section className="mx-auto flex min-h-48 max-w-lg flex-col items-center justify-center text-center">
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <LogInIcon className="size-5" />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">
          <T>Sign in to continue</T>
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          <T>Clerk securely connects this device to your Kairo account.</T>
        </p>
        <Button className="mt-5 min-w-48" onClick={onSignIn}>
          <T>Continue with Clerk</T>
          <ArrowRightIcon className="size-4" />
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-48 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
        {loading ? (
          <LoaderCircleIcon className="size-5 animate-spin" />
        ) : (
          <CheckCircle2Icon className="size-5" />
        )}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">
        {loading ? gt("Checking your account") : gt("Account connected")}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {loading
          ? gt("Loading secure sign-in.")
          : gt("Your Kairo account is ready. Next, tell us how you work.")}
      </p>
      <Button className="mt-5 min-w-40" disabled={loading} onClick={onContinue}>
        <T>Continue</T>
        <ArrowRightIcon className="size-4" />
      </Button>
    </section>
  );
}

function LocalSignInStep({ onContinue }: { readonly onContinue: () => void }) {
  return (
    <section className="mx-auto flex min-h-48 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
        <LogInIcon className="size-5" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">
        <T>Continue without an account</T>
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        <T>Clerk is not configured in this self-hosted build. You can still finish local setup.</T>
      </p>
      <Button className="mt-5 min-w-40" onClick={onContinue}>
        <T>Continue</T>
        <ArrowRightIcon className="size-4" />
      </Button>
    </section>
  );
}

function ClerkLoadErrorStep({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <section className="mx-auto flex min-h-48 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
        <RefreshCwIcon className="size-5" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">
        <T>Sign-in could not load</T>
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        <T>Check your connection, then retry. Your onboarding will stay here.</T>
      </p>
      <Button className="mt-5 min-w-40" onClick={onRetry}>
        <T>Retry sign-in</T>
        <RefreshCwIcon className="size-4" />
      </Button>
    </section>
  );
}

function ProfessionStep({
  role,
  otherRole,
  onRoleChange,
  onOtherRoleChange,
  onContinue,
}: {
  readonly role: ProfessionalRole | null;
  readonly otherRole: string;
  readonly onRoleChange: (role: ProfessionalRole) => void;
  readonly onOtherRoleChange: (value: string) => void;
  readonly onContinue: () => void;
}) {
  const complete = isProfessionalRoleComplete(role, otherRole);

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T>What best describes your work?</T>
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <T>Choose one so Kairo can tailor setup guidance to the way you build.</T>
        </p>
      </div>
      <ProfessionalRolePicker
        value={role}
        otherValue={otherRole}
        onChange={onRoleChange}
        onOtherValueChange={onOtherRoleChange}
      />
      <div className="mt-6 flex justify-end">
        <Button disabled={!complete} onClick={onContinue}>
          <T>Continue</T>
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function ProviderLogo({ option }: { readonly option: AgentOption }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
      <ProviderInstanceIcon
        driverKind={option.definition.driverKind}
        displayName={option.definition.label}
        iconClassName="size-5"
      />
    </span>
  );
}

function ProviderSetupStep({
  options,
  usableAgents,
  busy,
  busyProviderInstanceId,
  onInstall,
  onLogin,
  onRefresh,
  onComplete,
}: {
  readonly options: ReadonlyArray<AgentOption>;
  readonly usableAgents: ReadonlyArray<ServerProvider>;
  readonly busy: BusyAction;
  readonly busyProviderInstanceId: ProviderInstanceId | null;
  readonly onInstall: (option: AgentOption) => void;
  readonly onLogin: (option: AgentOption) => void;
  readonly onRefresh: () => void;
  readonly onComplete: () => void;
}) {
  const gt = useGT();
  const messages = useMessages();
  const hasUsableAgent = usableAgents.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            <T>Connect a coding agent</T>
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            <T>
              Install or sign in to one supported provider. Optional memory and connected apps come
              next.
            </T>
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
              messages,
            );

            return (
              <div
                className="grid gap-3 rounded-xl border border-border/80 bg-background/65 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                key={option.definition.driverKind}
              >
                <ProviderLogo option={option} />
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {option.definition.label}
                    </span>
                    <Badge size="sm" variant={agentBadgeVariant(provider)}>
                      {agentStatusLabel(provider, messages)}
                    </Badge>
                  </div>
                  <p
                    className={cn(
                      "text-xs leading-5 text-muted-foreground",
                      !progressLabel && "sm:line-clamp-2",
                    )}
                  >
                    {getOnboardingAgentDescription(provider, messages)}
                  </p>
                  {progressLabel ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span aria-live="polite" className="font-medium text-foreground">
                          {progressLabel}
                        </span>
                        <span className="text-muted-foreground">
                          <T>Keep Kairo open</T>
                        </span>
                      </div>
                      <progress
                        aria-label={gt("{provider} installation progress", {
                          provider: option.definition.label,
                        })}
                        className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  {action === "detected" ? (
                    <Button size="sm" variant="outline" disabled>
                      <CheckCircle2Icon className="size-3.5" />
                      <T>Detected</T>
                    </Button>
                  ) : action === "login" ? (
                    <Button size="sm" disabled={busy !== null} onClick={() => onLogin(option)}>
                      {targetBusy === "login-agent" ? (
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                      ) : (
                        <KeyRoundIcon className="size-3.5" />
                      )}
                      <T>Sign in</T>
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
                      <T>Refresh</T>
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
                        ? gt("Retry install")
                        : gt("Install")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <aside className="space-y-4 rounded-xl border border-border/80 bg-muted/25 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AppWindowIcon className="size-4 text-muted-foreground" />
          <T>Provider status</T>
        </div>
        {hasUsableAgent ? (
          <div className="space-y-2 text-sm">
            {usableAgents.map((provider) => (
              <div className="flex items-center justify-between gap-3" key={provider.instanceId}>
                <span className="truncate">{provider.displayName ?? provider.instanceId}</span>
                <Badge size="sm" variant="success">
                  <T>Ready</T>
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            <T>Connect one provider to continue.</T>
          </p>
        )}
        <div className="grid gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={onRefresh}>
            {busy === "refresh" ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            <T>Refresh</T>
          </Button>
          <Button size="sm" disabled={!hasUsableAgent || busy !== null} onClick={onComplete}>
            <T>Continue</T>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </aside>
    </div>
  );
}

function ProviderSetupGate({
  onProfessionEdit,
  onComplete,
}: {
  readonly onProfessionEdit?: () => void;
  readonly onComplete: () => void;
}) {
  const gt = useGT();
  const [setupStep, setSetupStep] = useState<"setup" | "memory" | "apps">("setup");
  const serverApi = usePrimaryServerApi();
  const serverProviders = useServerProviders();
  const [providersOverride, setProvidersOverride] = useState<ReadonlyArray<ServerProvider> | null>(
    null,
  );
  const providers = providersOverride ?? serverProviders;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [busyProviderInstanceId, setBusyProviderInstanceId] = useState<ProviderInstanceId | null>(
    null,
  );
  const didInitialLoadRef = useRef(false);

  const agentOptions: ReadonlyArray<AgentOption> = providerClients.definitions
    .filter((definition) => ONBOARDING_CODING_AGENT_DRIVERS.has(definition.driverKind))
    .map((definition) => ({
      definition,
      provider: providers.find((provider) => provider.driver === definition.driverKind),
    }));
  const usableAgents = providers.filter(isUsableOnboardingAgent);

  const refreshProviders = async () => {
    setBusy((current) => current ?? "refresh");
    const result = await settlePromise(async () => {
      const payload = await serverApi.refreshProviders();
      setProvidersOverride(payload.providers);
      return payload.providers;
    });
    setBusy((current) => (current === "refresh" ? null : current));
    if (result._tag === "Failure") throw squashAtomCommandFailure(result);
    return result.value;
  };

  const loadProviders = useEffectEvent(() => {
    void refreshProviders()
      .catch((error) => showOnboardingError(m(msg("Provider status unavailable")), error))
      .finally(() => setLoading(false));
  });

  // oxlint-disable-next-line kairo/no-unreasoned-state-sync -- reads installed provider status from the host when setup opens
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadProviders();
  }, []);

  const installAgent = async (option: AgentOption) => {
    const provider = option.provider;
    if (!provider) return;
    setBusy("install-agent");
    setBusyProviderInstanceId(provider.instanceId);
    const result = await settlePromise(async () => {
      const next = await serverApi.updateProvider({
        provider: provider.driver,
        instanceId: provider.instanceId,
      });
      const commandProvider = findOnboardingProvider(next.providers, provider.instanceId);
      const refreshed = await refreshProviders();
      const refreshedProvider = findOnboardingProvider(refreshed, provider.instanceId);
      const outcome = resolveOnboardingAgentInstallOutcome(
        commandProvider?.updateState?.status === "failed" ||
          commandProvider?.updateState?.status === "unchanged"
          ? commandProvider
          : (refreshedProvider ?? commandProvider),
      );
      if (outcome.kind === "ready") {
        toastManager.add(
          stackedThreadToast({ type: "success", title: `${option.definition.label} ready` }),
        );
      } else if (outcome.kind === "failed" || outcome.kind === "missing") {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: m(msg("Could not install {provider}", { provider: option.definition.label })),
            description: outcome.description,
          }),
        );
      } else {
        toastManager.add(
          stackedThreadToast({
            type: "warning",
            title:
              outcome.kind === "needs_login"
                ? m(
                    msg("{provider} installed. Sign in next.", {
                      provider: option.definition.label,
                    }),
                  )
                : m(msg("{provider} needs attention", { provider: option.definition.label })),
            description: outcome.description,
          }),
        );
      }
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showOnboardingError(
        m(msg("Could not install {provider}", { provider: option.definition.label })),
        error,
      );
    }
    setBusy(null);
    setBusyProviderInstanceId(null);
  };

  const loginAgent = async (option: AgentOption) => {
    const provider = option.provider;
    if (!provider) return;
    setBusy("login-agent");
    setBusyProviderInstanceId(provider.instanceId);
    const result = await settlePromise(async () => {
      const next = await serverApi.startProviderAuth({ instanceId: provider.instanceId });
      const interaction = next.interaction;
      if (interaction?.type === "browser" && !interaction.requiresConsent) {
        const url = new URL(interaction.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("The provider returned an invalid sign-in link.");
        }
        await ensureLocalApi().shell.openExternal(url.href);
      }
      const refreshed = await refreshProviders();
      const refreshedProvider = findOnboardingProvider(refreshed, provider.instanceId);
      const outcome = resolveOnboardingAgentReadiness(refreshedProvider);
      toastManager.add(
        stackedThreadToast(
          outcome.kind === "ready"
            ? { type: "success", title: `${option.definition.label} ready` }
            : {
                type: "warning",
                title: m(
                  msg("{provider} still needs attention", { provider: option.definition.label }),
                ),
                description: outcome.description,
              },
        ),
      );
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      showOnboardingError(
        m(msg("Could not sign in to {provider}", { provider: option.definition.label })),
        error,
      );
    }
    setBusy(null);
    setBusyProviderInstanceId(null);
  };

  if (setupStep !== "setup") {
    return (
      <OnboardingFrame activeStep={setupStep}>
        {setupStep === "memory" ? <SupermemorySettingsPanel /> : <ComposioSettingsPanel />}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setSetupStep(setupStep === "memory" ? "setup" : "memory")}
          >
            <T>Back</T>
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => (setupStep === "memory" ? setSetupStep("apps") : onComplete())}
            >
              <T>Skip for now</T>
            </Button>
            <Button onClick={() => (setupStep === "memory" ? setSetupStep("apps") : onComplete())}>
              {setupStep === "memory" ? gt("Continue") : gt("Finish setup")}
            </Button>
          </div>
        </div>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame activeStep="setup" onProfessionEdit={onProfessionEdit}>
      {loading ? (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"
        >
          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
          <T>Checking providers</T>
        </div>
      ) : (
        <ProviderSetupStep
          options={agentOptions}
          usableAgents={usableAgents}
          busy={busy}
          busyProviderInstanceId={busyProviderInstanceId}
          onInstall={(option) => void installAgent(option)}
          onLogin={(option) => void loginAgent(option)}
          onRefresh={() =>
            void refreshProviders().catch((error) =>
              showOnboardingError(gt("Provider refresh failed"), error),
            )
          }
          onComplete={() => setSetupStep("memory")}
        />
      )}
    </OnboardingFrame>
  );
}

function useProfessionSelection() {
  const role = useClientSettings((settings) => settings.professionalRole);
  const otherRole = useClientSettings((settings) => settings.professionalRoleOther);
  const setRole = (nextRole: ProfessionalRole) =>
    updateClientSettings({ professionalRole: nextRole });
  const setOtherRole = (nextOtherRole: string) =>
    updateClientSettings({ professionalRoleOther: nextOtherRole });

  return { role, setRole, otherRole, setOtherRole };
}

function CloudOnboardingFlow({ onComplete }: { readonly onComplete: () => void }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { role, setRole, otherRole, setOtherRole } = useProfessionSelection();
  const [activeStep, setActiveStep] = useState<OnboardingStep>("sign-in");
  const [signInStarted, setSignInStarted] = useState(false);

  if (activeStep === "sign-in" && signInStarted && isSignedIn) {
    setActiveStep("profession");
  }

  if (activeStep === "sign-in") {
    return (
      <OnboardingFrame activeStep="sign-in">
        <SignInStep
          loading={!isLoaded}
          signedIn={Boolean(isSignedIn)}
          onSignIn={() => {
            setSignInStarted(true);
            clerk.openSignIn(resolveClerkSignInProps(window.location.href, isElectron));
          }}
          onContinue={() => setActiveStep("profession")}
        />
      </OnboardingFrame>
    );
  }

  if (activeStep === "profession") {
    return (
      <OnboardingFrame activeStep="profession">
        <ProfessionStep
          role={role}
          otherRole={otherRole}
          onRoleChange={setRole}
          onOtherRoleChange={setOtherRole}
          onContinue={() => {
            if (!isProfessionalRoleComplete(role, otherRole)) return;
            if (role === "other") setOtherRole(otherRole.trim());
            setActiveStep("setup");
          }}
        />
      </OnboardingFrame>
    );
  }

  return (
    <ProviderSetupGate
      onProfessionEdit={() => setActiveStep("profession")}
      onComplete={onComplete}
    />
  );
}

function CloudOnboardingGate({ onComplete }: { readonly onComplete: () => void }) {
  return (
    <>
      <ClerkLoading>
        <OnboardingFrame activeStep="sign-in">
          <SignInStep
            loading
            signedIn={false}
            onSignIn={() => undefined}
            onContinue={() => undefined}
          />
        </OnboardingFrame>
      </ClerkLoading>
      <ClerkFailed>
        <OnboardingFrame activeStep="sign-in">
          <ClerkLoadErrorStep onRetry={() => window.location.reload()} />
        </OnboardingFrame>
      </ClerkFailed>
      <ClerkLoaded>
        <CloudOnboardingFlow onComplete={onComplete} />
      </ClerkLoaded>
    </>
  );
}

function LocalOnboardingGate({ onComplete }: { readonly onComplete: () => void }) {
  const { role, setRole, otherRole, setOtherRole } = useProfessionSelection();
  const [activeStep, setActiveStep] = useState<OnboardingStep>("sign-in");

  if (activeStep === "sign-in") {
    return (
      <OnboardingFrame activeStep="sign-in">
        <LocalSignInStep onContinue={() => setActiveStep(advanceOnboardingStep("sign-in"))} />
      </OnboardingFrame>
    );
  }

  if (activeStep === "profession") {
    return (
      <OnboardingFrame activeStep="profession">
        <ProfessionStep
          role={role}
          otherRole={otherRole}
          onRoleChange={setRole}
          onOtherRoleChange={setOtherRole}
          onContinue={() => {
            if (!isProfessionalRoleComplete(role, otherRole)) return;
            if (role === "other") setOtherRole(otherRole.trim());
            setActiveStep(advanceOnboardingStep("profession"));
          }}
        />
      </OnboardingFrame>
    );
  }

  return (
    <ProviderSetupGate
      onProfessionEdit={() => setActiveStep("profession")}
      onComplete={onComplete}
    />
  );
}

export function OnboardingGate({ onComplete }: { readonly onComplete: () => void }) {
  if (!hasCloudIdentityConfig()) {
    return <LocalOnboardingGate onComplete={onComplete} />;
  }

  return <CloudOnboardingGate onComplete={onComplete} />;
}
