import type { ArtifactMetadata, EnvironmentId } from "@kairo/contracts";
import { scopeThreadRef } from "@kairo/client-runtime/environment";
import { prependArtifactRevisionPrompt } from "@kairo/client-runtime/artifact-creation";
import { useNavigate } from "@tanstack/react-router";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
  PencilIcon,
} from "lucide-react";
import { useState } from "react";

import { useAssetUrlState } from "../../assets/assetUrls";
import { useComposerDraftStore } from "../../composerDraftStore";
import { cn } from "../../lib/utils";
import { buildThreadRouteParams } from "../../threadRoutes";
import { ARTIFACT_FORMAT_LABELS } from "./artifactDisplay";

const ARTIFACT_ICONS = {
  document: FileTextIcon,
  presentation: PresentationIcon,
  spreadsheet: FileSpreadsheetIcon,
  csv: FileSpreadsheetIcon,
  pdf: FileTextIcon,
} as const;

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatArtifactTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

function ArtifactAccess({
  artifact,
  environmentId,
}: {
  readonly artifact: ArtifactMetadata;
  readonly environmentId: EnvironmentId;
}) {
  const asset = useAssetUrlState(environmentId, {
    _tag: "workspace-document",
    threadId: artifact.threadId,
    path: artifact.relativePath,
  });
  const isPdf = artifact.kind === "pdf";

  if (asset._tag !== "Success") {
    return (
      <span className="shrink-0 px-2 text-muted-foreground text-xs">
        {asset._tag === "Failure" ? "Unavailable" : "Preparing..."}
      </span>
    );
  }

  return (
    <a
      aria-label={`${isPdf ? "Open" : "Download"} ${artifact.title}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      download={isPdf ? undefined : artifact.fileName}
      href={asset.url}
      rel={isPdf ? "noopener noreferrer" : undefined}
      target={isPdf ? "_blank" : undefined}
    >
      {isPdf ? (
        <ExternalLinkIcon className="size-3.5" aria-hidden />
      ) : (
        <DownloadIcon className="size-3.5" aria-hidden />
      )}
      {isPdf ? "Open" : "Download"}
    </a>
  );
}

export function ArtifactRow({
  artifact,
  environmentId,
  showProvenance = false,
}: {
  readonly artifact: ArtifactMetadata;
  readonly environmentId: EnvironmentId;
  readonly showProvenance?: boolean;
}) {
  const [accessRequested, setAccessRequested] = useState(false);
  const navigate = useNavigate();
  const formatLabel = ARTIFACT_FORMAT_LABELS[artifact.kind];
  const Icon = ARTIFACT_ICONS[artifact.kind];

  return (
    <div
      className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/55 focus-within:bg-accent/55"
      onPointerEnter={() => setAccessRequested(true)}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          artifact.kind === "pdf"
            ? "bg-red-500/10 text-red-600 dark:text-red-300"
            : artifact.kind === "presentation"
              ? "bg-orange-500/10 text-orange-600 dark:text-orange-300"
              : artifact.kind === "spreadsheet" || artifact.kind === "csv"
                ? "bg-green-500/10 text-green-600 dark:text-green-300"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-300",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm text-foreground">{artifact.title}</span>
        <span className="mt-0.5 block truncate text-muted-foreground text-xs">
          {showProvenance
            ? `${artifact.projectTitle} · ${artifact.threadTitle}`
            : artifact.fileName}
        </span>
        <span className="mt-1 block text-muted-foreground/80 text-[11px] tabular-nums">
          {formatLabel} · {formatFileSize(artifact.sizeBytes)} ·{" "}
          {formatArtifactTime(artifact.updatedAt)}
        </span>
      </span>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          const threadRef = scopeThreadRef(environmentId, artifact.threadId);
          const drafts = useComposerDraftStore.getState();
          drafts.setPrompt(
            threadRef,
            prependArtifactRevisionPrompt(
              artifact.relativePath,
              drafts.getComposerDraft(threadRef)?.prompt ?? "",
            ),
          );
          drafts.setInteractionMode(threadRef, "default");
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(threadRef),
          });
        }}
      >
        <PencilIcon className="size-3.5" aria-hidden />
        Revise
      </button>
      {accessRequested ? (
        <ArtifactAccess artifact={artifact} environmentId={environmentId} />
      ) : (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAccessRequested(true)}
        >
          {artifact.kind === "pdf" ? "Open" : "Download"}
        </button>
      )}
    </div>
  );
}
