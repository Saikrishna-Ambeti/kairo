import { ClerkFailed, ClerkLoaded, ClerkLoading, useAuth, useClerk } from "@clerk/react";
import {
  ProviderDriverKind as ProviderDriverKindSchema,
  isProviderAvailable,
  type ProviderDriverKind,
  type ProviderInstanceId,
  type ServerProvider,
} from "@kairo/contracts";
import * as Schema from "effect/Schema";
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { isElectron } from "../../env";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { cn } from "../../lib/utils";
import { useServerProviders } from "../../rpc/serverState";
import { usePrimaryServerApi } from "../../state/primaryServerApi";
import { resolveClerkSignInProps } from "../clerk/authRedirect";
import { PROVIDER_CLIENT_DEFINITIONS } from "../settings/providerDriverMeta";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ProfessionalRolePicker } from "./ProfessionalRolePicker";
import {
  isProfessionalRoleComplete,
  PROFESSIONAL_ROLE_OTHER_STORAGE_KEY,
  PROFESSIONAL_ROLE_STORAGE_KEY,
  ProfessionalRoleOtherSchema,
  ProfessionalRoleSchema,
  type ProfessionalRole,
} from "./professionalRole";

const CODING_AGENT_DRIVERS = new Set<ProviderDriverKind>([
  ProviderDriverKindSchema.make("codex"),
  ProviderDriverKindSchema.make("claudeAgent"),
  ProviderDriverKindSchema.make("opencode"),
]);

export type OnboardingStep = "sign-in" | "profession" | "setup";
type BusyAction = "refresh" | "install-agent" | "login-agent" | null;

interface AgentOption {
  readonly definition: (typeof PROVIDER_CLIENT_DEFINITIONS)[number];
  readonly provider: ServerProvider | undefined;
}

const ONBOARDING_STEPS: ReadonlyArray<{
  readonly key: OnboardingStep;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { key: "sign-in", label: "Sign in", icon: LogInIcon },
  { key: "profession", label: "Profession", icon: UserRoundIcon },
  { key: "setup", label: "Setup", icon: TerminalIcon },
];

export function advanceOnboardingStep(step: OnboardingStep): OnboardingStep {
  if (step === "sign-in") return "profession";
  return "setup";
}

export function isUsableOnboardingAgent(provider: ServerProvider): boolean {
  return (
    CODING_AGENT_DRIVERS.has(provider.driver) &&
    provider.enabled &&
    provider.installed &&
    isProviderAvailable(provider) &&
    provider.status === "ready"
  );
}

export function getOnboardingAgentAction(
  provider: ServerProvider | undefined,
): "detected" | "install" | "login" {
  if (provider && isUsableOnboardingAgent(provider)) return "detected";
  if (provider?.enabled && provider.installed && provider.auth.status === "unauthenticated") {
    return "login";
  }
  return "install";
}

export function getOnboardingAgentDescription(provider: ServerProvider | undefined): string {
  const action = getOnboardingAgentAction(provider);
  if (action === "login") {
    return "Sign in to this provider to finish detection.";
  }
  return (
    provider?.versionAdvisory?.updateCommand ??
    provider?.message ??
    "Install the CLI and refresh detection."
  );
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

function agentStatusLabel(provider: ServerProvider | undefined): string {
  if (!provider) return "Not configured";
  if (!provider.enabled) return "Disabled";
  if (!provider.installed) return "Not installed";
  if (provider.auth.status === "authenticated") return "Ready";
  if (provider.auth.status === "unauthenticated") return "Needs login";
  return statusText(provider.status);
}

function OnboardingProgress({
  activeStep,
  onProfessionEdit,
}: {
  readonly activeStep: OnboardingStep;
  readonly onProfessionEdit?: (() => void) | undefined;
}) {
  const activeIndex = ONBOARDING_STEPS.findIndex((step) => step.key === activeStep);

  return (
    <nav aria-label="Onboarding progress" className="grid gap-2 sm:grid-cols-3">
      {ONBOARDING_STEPS.map((step, index) => {
        const Icon = step.icon;
        const active = step.key === activeStep;
        const complete = index < activeIndex;
        const canEditProfession = step.key === "profession" && activeStep === "setup";
        const className = cn(
          "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition-colors",
          active && "border-primary/45 bg-primary/8 text-foreground",
          complete && !active && "border-success/25 bg-success/8 text-success-foreground",
          !active && !complete && "border-border bg-background/55 text-muted-foreground",
          canEditProfession &&
            "cursor-pointer hover:border-primary/35 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
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
            <span className="truncate font-medium">{step.label}</span>
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
    <div className="h-dvh overflow-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-lg shadow-black/5 sm:p-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Set up Kairo</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Sign in, tell us how you work, then connect a coding agent.
            </p>
          </div>
          <OnboardingProgress activeStep={activeStep} onProfessionEdit={onProfessionEdit} />
        </header>
        <main className="rounded-2xl border border-border/80 bg-card p-5 shadow-xl shadow-black/7 sm:p-6">
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
  if (!loading && !signedIn) {
    return (
      <section className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
        <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <LogInIcon className="size-5" />
        </span>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">Sign in to continue</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Clerk securely connects this device to your Kairo account.
        </p>
        <Button className="mt-6 min-w-48" onClick={onSignIn}>
          Continue with Clerk
          <ArrowRightIcon className="size-4" />
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
        {loading ? (
          <LoaderCircleIcon className="size-5 animate-spin" />
        ) : (
          <CheckCircle2Icon className="size-5" />
        )}
      </span>
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">
        {loading ? "Checking your account" : "Account connected"}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {loading
          ? "Loading secure sign-in."
          : "Your Kairo account is ready. Next, tell us how you work."}
      </p>
      <Button className="mt-6 min-w-40" disabled={loading} onClick={onContinue}>
        Continue
        <ArrowRightIcon className="size-4" />
      </Button>
    </section>
  );
}

function LocalSignInStep({ onContinue }: { readonly onContinue: () => void }) {
  return (
    <section className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
        <LogInIcon className="size-5" />
      </span>
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">Continue without an account</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Clerk is not configured in this self-hosted build. You can still finish local setup.
      </p>
      <Button className="mt-6 min-w-40" onClick={onContinue}>
        Continue
        <ArrowRightIcon className="size-4" />
      </Button>
    </section>
  );
}

function ClerkLoadErrorStep({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <section className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
        <RefreshCwIcon className="size-5" />
      </span>
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">Sign-in could not load</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Check your connection, then retry. Your onboarding will stay here.
      </p>
      <Button className="mt-6 min-w-40" onClick={onRetry}>
        Retry sign-in
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
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">
          What best describes your work?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose one so Kairo can tailor setup guidance to the way you build.
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
          Continue
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function ProviderLogo({ option }: { readonly option: AgentOption }) {
  const Icon = option.definition.icon;
  return (
    <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
      <Icon className="size-5" />
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
  const hasUsableAgent = usableAgents.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Connect a coding agent</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Install or sign in to one supported provider. Memory and app integrations stay in
            Settings.
          </p>
        </div>
        <div className="grid gap-3">
          {options.map((option) => {
            const provider = option.provider;
            const canInstall = Boolean(provider?.versionAdvisory?.canUpdate);
            const action = getOnboardingAgentAction(provider);
            const targetBusy =
              provider && busyProviderInstanceId === provider.instanceId ? busy : null;

            return (
              <div
                className="grid gap-3 rounded-xl border border-border/80 bg-background/65 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
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
                    {getOnboardingAgentDescription(provider)}
                  </p>
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
                      Sign in
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
                      Install
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
          Provider status
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
            Connect one provider to finish setup.
          </p>
        )}
        <div className="grid gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={onRefresh}>
            {busy === "refresh" ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            Refresh
          </Button>
          <Button size="sm" disabled={!hasUsableAgent || busy !== null} onClick={onComplete}>
            Finish setup
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
  const usableAgents = useMemo(() => providers.filter(isUsableOnboardingAgent), [providers]);

  const refreshProviders = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    try {
      const payload = await serverApi.refreshProviders();
      setProvidersOverride(payload.providers);
      return payload.providers;
    } finally {
      setBusy((current) => (current === "refresh" ? null : current));
    }
  }, [serverApi]);

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void refreshProviders()
      .catch((error) => showOnboardingError("Provider status unavailable", error))
      .finally(() => setLoading(false));
  }, [refreshProviders]);

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
      setProvidersOverride(next.providers);
      await refreshProviders();
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
      setProvidersOverride(next.providers);
      await refreshProviders();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: `${option.definition.label} sign-in command finished`,
        }),
      );
    } catch (error) {
      showOnboardingError(`Could not sign in to ${option.definition.label}`, error);
    } finally {
      setBusy(null);
      setBusyProviderInstanceId(null);
    }
  };

  return (
    <OnboardingFrame activeStep="setup" onProfessionEdit={onProfessionEdit}>
      {loading ? (
        <div
          role="status"
          className="flex min-h-80 items-center justify-center text-sm text-muted-foreground"
        >
          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
          Checking providers
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
              showOnboardingError("Provider refresh failed", error),
            )
          }
          onComplete={onComplete}
        />
      )}
    </OnboardingFrame>
  );
}

function useProfessionSelection() {
  const [role, setRole] = useLocalStorage<ProfessionalRole | null, ProfessionalRole | null>(
    PROFESSIONAL_ROLE_STORAGE_KEY,
    null,
    ProfessionalRoleSchema.pipe(Schema.NullOr),
  );
  const [otherRole, setOtherRole] = useLocalStorage(
    PROFESSIONAL_ROLE_OTHER_STORAGE_KEY,
    "",
    ProfessionalRoleOtherSchema,
  );

  return { role, setRole, otherRole, setOtherRole };
}

function CloudOnboardingFlow({ onComplete }: { readonly onComplete: () => void }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { role, setRole, otherRole, setOtherRole } = useProfessionSelection();
  const [activeStep, setActiveStep] = useState<OnboardingStep>("sign-in");
  const [signInStarted, setSignInStarted] = useState(false);

  useEffect(() => {
    if (activeStep === "sign-in" && signInStarted && isSignedIn) {
      setActiveStep("profession");
    }
  }, [activeStep, isSignedIn, signInStarted]);

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
  if (!hasCloudPublicConfig()) {
    return <LocalOnboardingGate onComplete={onComplete} />;
  }

  return <CloudOnboardingGate onComplete={onComplete} />;
}
