import type { ComposioStatus } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  getAvailableComposioCatalogItems,
  getConnectedComposioToolkits,
  getComposioPrimaryButtonState,
  getComposioSetupDialogCopy,
  getComposioSetupSteps,
  shouldShowComposioBackgroundOperation,
} from "./IntegrationsSettings.logic";

const baseStatus: ComposioStatus = {
  enabled: false,
  primaryAction: "install_and_login",
  cli: {
    status: "missing",
    platform: "darwin",
    installCommandLabel: "curl -fsSL https://composio.dev/install | bash",
    lastCheckedAt: "2026-06-14T00:00:00.000Z",
  },
  auth: { status: "unknown" },
  toolkits: [],
  agentSupport: [],
};

describe("Composio integrations settings logic", () => {
  it("shows Install & Login when the CLI is missing", () => {
    expect(
      getComposioPrimaryButtonState({
        primaryAction: "install_and_login",
        busy: false,
        operationRunning: false,
      }),
    ).toMatchObject({ visible: true, label: "Install & Login", disabled: false });
  });

  it("shows Login when the CLI exists but needs authentication", () => {
    expect(
      getComposioPrimaryButtonState({
        primaryAction: "login",
        busy: false,
        operationRunning: false,
      }),
    ).toMatchObject({ visible: true, label: "Login", disabled: false });
  });

  it("hides the install/login CTA when Composio is authenticated", () => {
    expect(
      getComposioPrimaryButtonState({
        primaryAction: "none",
        busy: false,
        operationRunning: false,
      }),
    ).toMatchObject({ visible: false, disabled: true });
  });

  it("uses install setup copy and includes the install step only for missing CLI setup", () => {
    expect(getComposioSetupDialogCopy("install_and_login")).toEqual({
      title: "Set up Composio",
      description:
        "T3 Code will install the Composio CLI, then open the Composio sign-in flow. You can close this dialog. Setup will continue in the background.",
    });
    expect(getComposioSetupSteps("install_and_login")).toEqual([
      "Checking CLI",
      "Installing CLI",
      "Signing in",
      "Verifying account",
      "Installing agent support",
    ]);
  });

  it("uses login-only setup copy and skips the install step", () => {
    expect(getComposioSetupDialogCopy("login")).toEqual({
      title: "Sign in to Composio",
      description:
        "T3 Code found the Composio CLI and will open the Composio sign-in flow. You can close this dialog. Setup will continue in the background.",
    });
    expect(getComposioSetupSteps("login")).toEqual([
      "Checking CLI",
      "Signing in",
      "Verifying account",
      "Installing agent support",
    ]);
  });

  it("keeps the background operation visible after the dialog is closed", () => {
    const runningStatus: ComposioStatus = {
      ...baseStatus,
      operation: {
        id: "operation-1",
        kind: "install_and_login",
        status: "running",
        startedAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:01.000Z",
      },
    };

    expect(shouldShowComposioBackgroundOperation(runningStatus, false)).toBe(true);
    expect(shouldShowComposioBackgroundOperation(runningStatus, true)).toBe(false);
    expect(
      getComposioPrimaryButtonState({
        primaryAction: runningStatus.primaryAction,
        busy: false,
        operationRunning: true,
      }),
    ).toMatchObject({ visible: true, disabled: true, runningLabel: "Setup running" });
  });

  it("keeps suggested or unknown Composio apps out of the connected apps list", () => {
    const status: ComposioStatus = {
      ...baseStatus,
      toolkits: [
        {
          toolkit: "slack",
          label: "Slack",
          category: "communication",
          connectionStatus: "connected",
        },
        {
          toolkit: "notion",
          label: "Notion",
          category: "productivity",
          connectionStatus: "unknown",
        },
        {
          toolkit: "gmail",
          label: "Gmail",
          category: "google-workspace",
          connectionStatus: "not_connected",
        },
      ],
    };

    expect(getConnectedComposioToolkits(status).map((toolkit) => toolkit.toolkit)).toEqual([
      "slack",
    ]);
  });

  it("filters connected Composio apps out of the app browser catalog", () => {
    const status: ComposioStatus = {
      ...baseStatus,
      toolkits: [
        {
          toolkit: "slack",
          label: "Slack",
          category: "communication",
          connectionStatus: "connected",
        },
      ],
    };

    expect(
      getAvailableComposioCatalogItems(
        [
          { toolkit: "slack", label: "Slack" },
          { toolkit: "gmail", label: "Gmail" },
        ],
        status,
      ).map((item) => item.toolkit),
    ).toEqual(["gmail"]);
  });

  it("searches the app browser catalog locally after connected apps are removed", () => {
    const status: ComposioStatus = {
      ...baseStatus,
      toolkits: [
        {
          toolkit: "slack",
          label: "Slack",
          category: "communication",
          connectionStatus: "connected",
        },
      ],
    };

    expect(
      getAvailableComposioCatalogItems(
        [
          {
            toolkit: "slack",
            label: "Slack",
            description: "Team communication",
          },
          {
            toolkit: "gmail",
            label: "Gmail",
            category: "Google Workspace",
            description: "Read and send email",
          },
          {
            toolkit: "github",
            label: "GitHub",
            description: "Manage repositories",
          },
        ],
        status,
        "email",
      ).map((item) => item.toolkit),
    ).toEqual(["gmail"]);
  });
});
