import type { ScopedThreadRef } from "@kairo/contracts";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { useMemo } from "react";

import type { MarkdownFileLinkMeta } from "../../markdown-links";
import { useAssetUrlState } from "../../assets/assetUrls";
import { cn } from "../../lib/utils";

interface MarkdownDocumentArtifactLinkProps {
  readonly meta: MarkdownFileLinkMeta;
  readonly threadRef: ScopedThreadRef;
  readonly copyMarkdown: string;
  readonly className?: string;
}

export function isDocumentArtifactPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return lowerPath.endsWith(".pdf") || lowerPath.endsWith(".docx");
}

export function MarkdownDocumentArtifactLink(props: MarkdownDocumentArtifactLinkProps) {
  const resource = useMemo(
    () => ({
      _tag: "workspace-document" as const,
      threadId: props.threadRef.threadId,
      path: props.meta.workspaceRelativePath!,
    }),
    [props.meta.workspaceRelativePath, props.threadRef.threadId],
  );
  const asset = useAssetUrlState(props.threadRef.environmentId, resource);
  const isPdf = props.meta.filePath.toLowerCase().endsWith(".pdf");
  const formatLabel = isPdf ? "PDF" : "Word document";

  return (
    <span
      className={cn(
        "my-1 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-border/80 bg-foreground/[0.025] px-2.5 py-2 align-middle shadow-xs/5",
        props.className,
      )}
      data-markdown-copy={props.copyMarkdown}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <FileTextIcon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">{props.meta.basename}</span>
        <span className="block text-muted-foreground text-xs">{formatLabel} artifact</span>
      </span>
      {asset._tag === "Success" ? (
        <a
          href={asset.url}
          target={isPdf ? "_blank" : undefined}
          rel={isPdf ? "noopener noreferrer" : undefined}
          download={isPdf ? undefined : props.meta.basename}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10"
          aria-label={`${isPdf ? "Open" : "Download"} ${props.meta.basename}`}
        >
          {isPdf ? (
            <ExternalLinkIcon className="size-3.5" />
          ) : (
            <DownloadIcon className="size-3.5" />
          )}
          {isPdf ? "Open" : "Download"}
        </a>
      ) : (
        <span className="shrink-0 px-2 text-muted-foreground text-xs">
          {asset._tag === "Failure" ? "Unavailable" : "Loading..."}
        </span>
      )}
    </span>
  );
}
