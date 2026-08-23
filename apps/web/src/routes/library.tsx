import { createFileRoute } from "@tanstack/react-router";

import { LibraryPage } from "../components/artifacts/LibraryPage";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});
