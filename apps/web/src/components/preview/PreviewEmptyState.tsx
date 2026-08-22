import type { ScopedThreadRef } from "@kairo/contracts";
import { Globe, History } from "lucide-react";

import type { BrowserHistoryEntry } from "~/browserHistoryStore";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "~/components/ui/empty";

import { PreviewRecentUrlCard } from "./PreviewRecentUrlCard";

interface Props {
  threadRef: ScopedThreadRef;
  recentEntries: ReadonlyArray<BrowserHistoryEntry>;
  onRemoveRecent: (url: string) => void;
  onOpenUrl: (url: string) => void;
}

export function PreviewEmptyState({ threadRef, recentEntries, onRemoveRecent, onOpenUrl }: Props) {
  const recents = recentEntries.filter((entry) => URL.canParse(entry.url)).slice(0, 8);

  if (recents.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Globe className="size-4.5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No preview yet</EmptyTitle>
        <EmptyDescription>Type a URL above to open a page.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-y-auto px-5 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        {recents.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="size-4 shrink-0" />
              <h2 className="font-medium">Recently used</h2>
            </div>
            <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background">
              {recents.map((entry) => (
                <PreviewRecentUrlCard
                  key={entry.url}
                  threadRef={threadRef}
                  entry={entry}
                  onOpen={() => onOpenUrl(entry.url)}
                  onRemove={() => onRemoveRecent(entry.url)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
