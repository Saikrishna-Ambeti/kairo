import { createFileRoute, Navigate } from "@tanstack/react-router";

import { SourceControlSettingsPanel } from "../components/settings/SourceControlSettings";
import { isSourceControlVisible, useProductSurfaceConfig } from "../productSurfaces";

function SourceControlSettingsRoute() {
  const surface = useProductSurfaceConfig();
  if (!isSourceControlVisible(surface)) {
    return <Navigate to="/settings/general" replace />;
  }
  return <SourceControlSettingsPanel />;
}

export const Route = createFileRoute("/settings/source-control")({
  component: SourceControlSettingsRoute,
});
