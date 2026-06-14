import { createFileRoute } from "@tanstack/react-router";

import { ComposioAppsSettings } from "../components/settings/ComposioAppsSettings";

export const Route = createFileRoute("/settings/integrations_/apps")({
  component: ComposioAppsSettings,
});
