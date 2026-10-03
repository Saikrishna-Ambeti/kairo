import { isElectron } from "~/env";
import { openCommandPalette } from "../../commandPaletteBus";
import {
  FilePlus2Icon,
  FileSearchIcon,
  PackageOpenIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useArtifacts } from "../../state/artifacts";
import { useActiveEnvironmentId } from "../../state/entities";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { ScrollArea } from "../ui/scroll-area";
import { SidebarInset } from "../ui/sidebar";
import { ArtifactRow } from "./ArtifactRow";
import { ARTIFACT_FILTERS, type ArtifactFilter } from "./artifactDisplay";

export function LibraryPage() {
  const environmentId = useActiveEnvironmentId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArtifactFilter>("all");

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const { artifacts, error, isPending, refresh } = useArtifacts(environmentId, {
    ...(query.length > 0 ? { query } : {}),
    ...(filter === "all" ? {} : { kinds: [filter] }),
    limit: 300,
  });

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Library breadcrumb" className="min-w-0">
            <WorkspaceBreadcrumbItem current>
              <h1>Library</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          <Button
            className="ms-auto"
            onClick={() => openCommandPalette({ open: "create-file" })}
            size="sm"
          >
            <FilePlus2Icon className="size-4" />
            Create file
          </Button>
          <Button aria-label="Refresh library" onClick={refresh} size="icon-sm" variant="ghost">
            <RefreshCwIcon className="size-3.5" />
          </Button>
        </WorkspacePageHeader>

        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide" className="gap-5">
            <section aria-labelledby="library-heading" className="flex flex-col gap-4">
              <div className="max-w-2xl">
                <h2 id="library-heading" className="text-xl font-semibold tracking-tight">
                  Files
                </h2>
                <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                  Files created by agents across every project and thread in this environment.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 flex-1 sm:max-w-xl">
                  <span className="sr-only">Search library</span>
                  <InputGroup>
                    <InputGroupAddon>
                      <SearchIcon aria-hidden />
                    </InputGroupAddon>
                    <InputGroupInput
                      nativeInput
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.currentTarget.value)}
                      placeholder="Search titles, files, projects, and threads"
                    />
                  </InputGroup>
                </label>
                <div className="flex shrink-0 items-center gap-1" aria-label="Artifact type">
                  {ARTIFACT_FILTERS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      className="rounded-md px-2.5 py-1.5 text-muted-foreground text-xs hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-foreground"
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section aria-live="polite" aria-label="Artifact library">
              {environmentId === null ? (
                <LibraryEmptyState
                  icon={PackageOpenIcon}
                  title="No environment selected"
                  description="Open an environment to browse its artifact library."
                />
              ) : error ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                  <p className="font-medium text-sm">Library could not load</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Check the environment, then retry.
                  </p>
                </div>
              ) : isPending && artifacts.length === 0 ? (
                <div
                  className="divide-y divide-border/60 rounded-lg border border-border/70 p-2"
                  aria-label="Loading library"
                >
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-[76px] rounded-lg bg-muted/45" />
                  ))}
                </div>
              ) : artifacts.length === 0 ? (
                <LibraryEmptyState
                  icon={query.length > 0 ? FileSearchIcon : PackageOpenIcon}
                  title={query.length > 0 ? "No matching artifacts" : "Your library is empty"}
                  description={
                    query.length > 0
                      ? "Try another title, filename, project, or thread."
                      : "Ask an agent to create a document, presentation, spreadsheet, CSV, or PDF. It will appear here automatically."
                  }
                />
              ) : (
                <div>
                  <p className="mb-2 px-3 text-muted-foreground text-xs tabular-nums">
                    {artifacts.length} {artifacts.length === 1 ? "artifact" : "artifacts"}
                  </p>
                  <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/25 p-2">
                    {artifacts.map((artifact) => (
                      <ArtifactRow
                        key={`${artifact.threadId}:${artifact.relativePath}`}
                        artifact={artifact}
                        environmentId={environmentId}
                        showProvenance
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}

function LibraryEmptyState({
  icon: Icon,
  title,
  description,
}: {
  readonly icon: typeof PackageOpenIcon;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-medium text-sm">{title}</h3>
      <p className="mt-1 max-w-sm text-muted-foreground text-xs leading-relaxed">{description}</p>
    </div>
  );
}
