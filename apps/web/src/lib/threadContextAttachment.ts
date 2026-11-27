import type { EnvironmentId, OrchestrationV2ThreadTranscript } from "@kairo/contracts";
import { splitsSurrogatePair } from "@kairo/shared/assistantCitations";
import { toKindScopedComposerContextId } from "@kairo/shared/composerContextReferences";
import { threadTranscriptHeader } from "@kairo/shared/threadTranscript";
import * as DateTime from "effect/DateTime";

export function threadContextAttachment(
  environmentId: EnvironmentId,
  transcript: OrchestrationV2ThreadTranscript,
): File {
  const updatedAt = DateTime.formatIso(transcript.updatedAt);
  const name = toKindScopedComposerContextId(
    "thread",
    `${environmentId}:${transcript.threadId}:${updatedAt}`,
  );
  const sanitized = transcript.title.replace(/[^\p{L}\p{N}._ -]/gu, "_");
  const title = sanitized.slice(0, splitsSurrogatePair(sanitized, 64) ? 63 : 64) || "Thread";
  return new File(
    [
      threadTranscriptHeader(environmentId, transcript),
      ...transcript.items.map((row) => `${JSON.stringify(row)}\n`),
    ],
    `${title}-${name.slice(-16)}.jsonl`,
    { type: "application/x-ndjson" },
  );
}
