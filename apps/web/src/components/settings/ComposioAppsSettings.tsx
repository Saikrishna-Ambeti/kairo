import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CloudIcon, ExternalLinkIcon } from "lucide-react";

import { ensureLocalApi } from "../../localApi";
import { Button } from "../ui/button";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

const COMPOSIO_DASHBOARD_URL = "https://dashboard.composio.dev";

export function ComposioAppsSettings() {
  return (
    <SettingsPageContainer>
      <SettingsSection icon={<CloudIcon className="size-3.5" />} title="Composio apps">
        <div className="space-y-5 p-5">
          <Button variant="ghost" render={<Link to="/settings/integrations" />}>
            <ArrowLeftIcon className="size-4" />
            Integrations
          </Button>
          <div className="max-w-2xl space-y-2">
            <h2 className="text-sm font-semibold">Apps now live in Composio Connect</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Connect, remove, or reauthorize apps in Composio Dashboard. Agents can also create a
              secure connection link when a task needs an app that is not connected yet.
            </p>
          </div>
          <Button onClick={() => void ensureLocalApi().shell.openExternal(COMPOSIO_DASHBOARD_URL)}>
            <ExternalLinkIcon className="size-4" />
            Open Composio Dashboard
          </Button>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
