import { useNavigate } from "@tanstack/react-router";
import { completeOnboarding } from "../../onboarding/firstRun";
import { toastManager } from "../ui/toast";
import { OnboardingGate } from "./OnboardingGate";

export function LocalOnboarding() {
  const navigate = useNavigate();
  return (
    <OnboardingGate
      onComplete={() => {
        void completeOnboarding().then(
          () => navigate({ to: "/", replace: true }),
          (error: unknown) =>
            toastManager.add({
              type: "error",
              title: "Could not save setup",
              description: error instanceof Error ? error.message : "Try again.",
            }),
        );
      }}
    />
  );
}
