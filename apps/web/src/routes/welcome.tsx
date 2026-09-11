import { createFileRoute, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { NoProjectsHero } from "../components/NoProjectsHero";
import { OnboardingGate } from "../components/onboarding/OnboardingGate";
import { useCompleteOnboarding } from "../onboarding/firstRun";
import { toastManager } from "../components/ui/toast";
import { WelcomeWizard } from "../components/onboarding/WelcomeWizard";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";

/** Onboarding overlays the workspace. Visiting /welcome reopens setup. */
export const Route = createFileRoute("/welcome")({
  beforeLoad: ({ context }) => {
    const { authGateState } = context;
    if (authGateState.status !== "authenticated" && authGateState.status !== "hosted-static") {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: WelcomeRouteView,
});

function WelcomeRouteView() {
  const { authGateState } = Route.useRouteContext();
  const navigate = useNavigate();
  // The root shell can remount this pending outlet after the location changes.
  // Never reopen setup while the destination route is still loading.
  const isWelcomeRoute = useLocation({ select: (location) => location.pathname === "/welcome" });
  const [dismissed, setDismissed] = useState(false);
  const openNewThread = useNewThreadHandler();
  const completeOnboarding = useCompleteOnboarding();
  // An authenticated gate means a primary server is serving this app —
  // desktop, `npx kairo`, or a dev server — and that server is "this machine"
  // no matter what hostname the browser used. Only hosted-static has no
  // local server to offer.
  const localAvailable = authGateState.status === "authenticated";
  if (localAvailable) {
    return isWelcomeRoute && !dismissed ? (
      <OnboardingGate
        onComplete={() => {
          void completeOnboarding().then(
            () => {
              setDismissed(true);
              void navigate({ to: "/", replace: true });
            },
            (error: unknown) =>
              toastManager.add({
                type: "error",
                title: "Could not save setup",
                description: error instanceof Error ? error.message : "Try again.",
              }),
          );
        }}
      />
    ) : null;
  }
  return (
    <>
      <NoProjectsHero />
      {isWelcomeRoute && !dismissed ? (
        <WelcomeWizard
          localAvailable={localAvailable}
          onDone={(projectRef) => {
            setDismissed(true);
            if (projectRef !== undefined) {
              void openNewThread(projectRef, { replace: true }).catch(() => {
                void navigate({ to: "/", replace: true });
              });
              return;
            }
            void navigate({ to: "/", replace: true });
          }}
        />
      ) : null}
    </>
  );
}
