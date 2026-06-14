import type {
  ComposioPrimaryAction,
  ComposioStatus,
  ComposioToolkitCatalogItem,
  ComposioToolkitStatus,
} from "@kairo/contracts";

export type SetupMode = "install_and_login" | "login";

export interface ComposioPrimaryButtonState {
  readonly visible: boolean;
  readonly label: "Install & Login" | "Login";
  readonly disabled: boolean;
  readonly runningLabel: "Setup running";
}

export function getComposioPrimaryButtonState(input: {
  readonly primaryAction: ComposioPrimaryAction;
  readonly busy: boolean;
  readonly operationRunning: boolean;
}): ComposioPrimaryButtonState {
  return {
    visible: input.primaryAction !== "none",
    label: input.primaryAction === "login" ? "Login" : "Install & Login",
    disabled: input.primaryAction === "none" || input.busy || input.operationRunning,
    runningLabel: "Setup running",
  };
}

export function getComposioSetupSteps(mode: SetupMode): ReadonlyArray<string> {
  return [
    "Checking CLI",
    ...(mode === "install_and_login" ? ["Installing CLI"] : []),
    "Signing in",
    "Verifying account",
    "Installing agent support",
  ];
}

export function getComposioSetupDialogCopy(mode: SetupMode): {
  readonly title: string;
  readonly description: string;
} {
  const modeDescription =
    mode === "install_and_login"
      ? "Kairo will install the Composio CLI, then open the Composio sign-in flow."
      : "Kairo found the Composio CLI and will open the Composio sign-in flow.";
  return {
    title: mode === "install_and_login" ? "Set up Composio" : "Sign in to Composio",
    description: `${modeDescription} You can close this dialog. Setup will continue in the background.`,
  };
}

export function shouldShowComposioBackgroundOperation(
  status: ComposioStatus | null,
  dialogOpen: boolean,
): boolean {
  return status?.operation?.status === "running" && !dialogOpen;
}

export function getConnectedComposioToolkits(
  status: ComposioStatus | null,
): ReadonlyArray<ComposioToolkitStatus> {
  return (status?.toolkits ?? []).filter((toolkit) => toolkit.connectionStatus === "connected");
}

export function getAvailableComposioCatalogItems(
  items: ReadonlyArray<ComposioToolkitCatalogItem>,
  status: ComposioStatus | null,
  query = "",
): ReadonlyArray<ComposioToolkitCatalogItem> {
  const connected = new Set(
    getConnectedComposioToolkits(status).map((toolkit) => toolkit.toolkit.toLowerCase()),
  );
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (connected.has(item.toolkit.toLowerCase())) return false;
    if (!normalizedQuery) return true;
    return (
      item.toolkit.toLowerCase().includes(normalizedQuery) ||
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.category?.toLowerCase().includes(normalizedQuery) ||
      item.description?.toLowerCase().includes(normalizedQuery)
    );
  });
}
