import { createFileRoute } from "@tanstack/react-router";

import { SupermemorySettingsPanel } from "../components/settings/SupermemorySettings";

function SettingsMemoryRoute() {
  return <SupermemorySettingsPanel />;
}

export const Route = createFileRoute("/settings/memory")({
  component: SettingsMemoryRoute,
});
