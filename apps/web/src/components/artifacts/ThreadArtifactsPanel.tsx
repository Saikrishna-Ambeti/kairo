import type { EnvironmentId, ThreadId } from "@kairo/contracts";
import { FileTextIcon, PackageOpenIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { useArtifacts } from "../../state/artifacts";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { ArtifactRow } from "./ArtifactRow";

type ArtifactFilter = "all" | "document" | "pdf";

export function ThreadArtifactsPanel({
  environmentId,
  threadId,
  refreshToken,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly refreshToken: string;
}) {
  const [filter, setFilter] = useState<ArtifactFilter>("all");
  const { artifacts, error, isPending, refresh } = useArtifacts(environmentId, {
    threadId,
    ...(filter === "all" ? {} : { kinds: [filter] }),
    limit: 200,
  });
  const refreshArtifacts = useEffectEvent(refresh);

  useEffect(() => {
    refreshArtifacts();
  }, [refreshToken]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border/70 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1" aria-label="Artifact type">
          {(["all", "document", "pdf"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground text-xs hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-foreground"
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : value === "document" ? "Documents" : "PDFs"}
            </button>
          ))}
        </div>
        <Button aria-label="Refresh artifacts" onClick={refresh} size="icon-xs" variant="ghost">
          <RefreshCwIcon className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {error ? (
            <div className="m-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-foreground">Artifacts could not load</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Check the environment, then retry.
              </p>
            </div>
          ) : isPending && artifacts.length === 0 ? (
            <div className="space-y-2 p-2" aria-label="Loading artifacts">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 rounded-lg bg-muted/55" />
              ))}
            </div>
          ) : artifacts.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-8 text-center">
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                {filter === "all" ? (
                  <PackageOpenIcon className="size-5" aria-hidden />
                ) : (
                  <FileTextIcon className="size-5" aria-hidden />
                )}
              </span>
              <h2 className="mt-4 font-medium text-sm text-foreground">No artifacts yet</h2>
              <p className="mt-1 max-w-64 text-muted-foreground text-xs leading-relaxed">
                Ask the agent to create a Word document or PDF. Finished files appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {artifacts.map((artifact) => (
                <ArtifactRow
                  key={`${artifact.threadId}:${artifact.relativePath}`}
                  artifact={artifact}
                  environmentId={environmentId}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
