import { createFileRoute } from "@tanstack/react-router";

import { ComposioAppsSettings } from "../components/settings/ComposioAppsSettings";

export const Route = createFileRoute("/_chat/settings/integrations_/apps")({
  component: ComposioAppsSettings,
});
