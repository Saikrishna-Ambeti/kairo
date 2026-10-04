import type { EnvironmentId, ScopedThreadRef } from "@kairo/contracts";
import { DownloadIcon, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAssetUrlState } from "~/assets/assetUrls";

import { assertOfficeArchiveWithinLimit } from "./officeArchiveLimits";
import DocxPreviewWorker from "./docxPreview.worker?worker";
import PptxPreviewWorker from "./pptxPreview.worker?worker";
import XlsxPreviewWorker from "./xlsxPreview.worker?worker";

const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
type DocumentKind = "docx" | "pptx" | "xlsx";

const CONVERSION_TIMEOUT_MS: Record<DocumentKind, number> = {
  docx: 10_000,
  pptx: 30_000,
  xlsx: 20_000,
};

function documentFrame(html: string, kind: DocumentKind): string {
  const width = kind === "pptx" ? "1200px" : kind === "xlsx" ? "100%" : "840px";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html{background:#f2f2f2;color:#222;font:16px/1.55 system-ui,sans-serif}body{box-sizing:border-box;max-width:${width};min-height:100%;margin:24px auto;padding:48px;background:white;box-shadow:0 2px 16px #0002}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:5px 8px;white-space:nowrap}th{background:#f5f5f5;font-weight:600}.sheet{margin-bottom:36px}.sheet h2{font-size:18px}.sheet-scroll{max-width:100%;overflow:auto}.slide{margin-bottom:28px}.slide svg{display:block;width:100%;height:auto;background:white;box-shadow:0 2px 12px #0002}.slide-label,.preview-note{color:#666;font-size:13px}@media(max-width:700px){body{margin:0;padding:20px;box-shadow:none}}</style></head><body>${html}</body></html>`;
}

async function readPreviewBytes(response: Response, signal: AbortSignal): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Document stream unavailable.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PREVIEW_BYTES) throw new Error("Document too large to preview.");
      chunks.push(value);
    }
    if (signal.aborted) throw new Error("Document preview canceled.");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
}

function convertInWorker(
  buffer: ArrayBuffer,
  kind: DocumentKind,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) return Promise.reject(new Error("Document preview canceled."));
  return new Promise((resolve, reject) => {
    const worker =
      kind === "docx"
        ? new DocxPreviewWorker()
        : kind === "pptx"
          ? new PptxPreviewWorker()
          : new XlsxPreviewWorker();
    let settled = false;
    const finish = (result: { html?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      worker.terminate();
      if (result.html !== undefined) resolve(result.html);
      else reject(new Error(result.error ?? "Unable to convert document."));
    };
    const onAbort = () => finish({ error: "Document preview canceled." });
    const timeout = window.setTimeout(
      () => finish({ error: "Document preview timed out." }),
      CONVERSION_TIMEOUT_MS[kind],
    );
    signal.addEventListener("abort", onAbort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<{ html?: string; error?: string }>) =>
      finish(event.data),
    );
    worker.addEventListener("error", () => finish({ error: "Unable to convert document." }));
    worker.postMessage(buffer, [buffer]);
  });
}

export function WorkspaceDocumentPreview(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly relativePath: string;
  readonly workspaceMutationId: string | null;
  readonly kind: DocumentKind;
}) {
  const resource = useMemo(
    () => ({
      _tag: "workspace-document" as const,
      threadId: props.threadRef.threadId,
      path: props.relativePath,
    }),
    [props.relativePath, props.threadRef.threadId],
  );
  const asset = useAssetUrlState(props.environmentId, resource);
  const url = asset._tag === "Success" ? asset.url : null;
  const previewKey = `${url ?? ""}:${props.workspaceMutationId ?? ""}`;
  const [preview, setPreview] = useState<{ key: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState<{ key: string; message: string } | null>(null);
  const error = previewError?.key === previewKey ? previewError.message : null;

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    void (async () => {
      let timedOut = false;
      try {
        const revisionUrl = new URL(url, window.location.href);
        if (props.workspaceMutationId) {
          revisionUrl.searchParams.set("workspace-revision", props.workspaceMutationId);
        }
        const timeout = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, DOWNLOAD_TIMEOUT_MS);
        let buffer: ArrayBuffer;
        try {
          const response = await fetch(revisionUrl, { signal: controller.signal });
          if (!response.ok) throw new Error("Unable to load document.");
          const size = Number(response.headers.get("content-length"));
          if (size > MAX_PREVIEW_BYTES) throw new Error("Document too large to preview.");
          buffer = await readPreviewBytes(response, controller.signal);
        } finally {
          window.clearTimeout(timeout);
        }
        assertOfficeArchiveWithinLimit(buffer);
        const html = await convertInWorker(buffer, props.kind, controller.signal);
        if (!controller.signal.aborted) {
          setPreviewError(null);
          setPreview({ key: previewKey, html: documentFrame(html, props.kind) });
        }
      } catch {
        if (timedOut || !controller.signal.aborted)
          setPreviewError({
            key: previewKey,
            message: "Unable to preview document. Download it to open in another app.",
          });
      }
    })();
    return () => controller.abort();
  }, [url, props.workspaceMutationId, props.kind, previewKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {url ? (
        <div className="flex shrink-0 justify-end border-b border-border/60 px-3 py-1.5">
          <a
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
            href={url}
            download={props.relativePath.split(/[\\/]/).at(-1)}
          >
            <DownloadIcon className="size-3.5" aria-hidden /> Download
          </a>
        </div>
      ) : null}
      {asset._tag === "Failure" || error ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-destructive">
          {error ?? "Unable to load document."}
        </div>
      ) : preview?.key === previewKey && url !== null ? (
        <iframe
          className="min-h-0 flex-1 border-0 bg-white"
          title={props.relativePath}
          srcDoc={preview.html}
          sandbox=""
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
