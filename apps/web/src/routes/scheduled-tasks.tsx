import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/scheduled-tasks")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/scheduled-tasks" });
  },
});
