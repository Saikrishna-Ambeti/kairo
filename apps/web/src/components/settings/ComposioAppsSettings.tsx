import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CloudIcon } from "lucide-react";

import { Button } from "../ui/button";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

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
            <h2 className="text-sm font-semibold">Apps connect when needed</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ask an agent to use an app. Composio returns a secure sign-in link when that app is
              not connected. Each Kairo account keeps its own connections.
            </p>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
