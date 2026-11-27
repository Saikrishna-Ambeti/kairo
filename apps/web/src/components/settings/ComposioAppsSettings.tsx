import { T, useGT } from "gt-react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CloudIcon } from "lucide-react";

import { Button } from "../ui/button";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

export function ComposioAppsSettings() {
  const gt = useGT();
  return (
    <SettingsPageContainer>
      <SettingsSection icon={<CloudIcon className="size-3.5" />} title={gt("Composio apps")}>
        <div className="space-y-5 p-5">
          <Button variant="ghost" render={<Link to="/settings/integrations" />}>
            <ArrowLeftIcon className="size-4" />
            <T>Integrations</T>
          </Button>
          <div className="max-w-2xl space-y-2">
            <h2 className="text-sm font-semibold">
              <T>Apps connect when needed</T>
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <T>
                Ask an agent to use an app. Composio returns a secure sign-in link when that app is
                not connected. Each Kairo account keeps its own connections.
              </T>
            </p>
          </div>
        </div>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
