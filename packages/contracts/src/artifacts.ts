import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas.ts";

export const ArtifactKind = Schema.Literals(["document", "pdf"]);
export type ArtifactKind = typeof ArtifactKind.Type;

export const ArtifactMetadata = Schema.Struct({
  projectId: ProjectId,
  projectTitle: TrimmedNonEmptyString,
  threadId: ThreadId,
  threadTitle: TrimmedNonEmptyString,
  turnId: TurnId,
  kind: ArtifactKind,
  title: TrimmedNonEmptyString,
  fileName: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString,
  sizeBytes: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ArtifactMetadata = typeof ArtifactMetadata.Type;

export const ArtifactListInput = Schema.Struct({
  threadId: Schema.optional(ThreadId),
  query: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  kinds: Schema.optional(Schema.Array(ArtifactKind)),
  limit: Schema.optional(NonNegativeInt.check(Schema.isLessThanOrEqualTo(500))),
});
export type ArtifactListInput = typeof ArtifactListInput.Type;

export const ArtifactListResult = Schema.Struct({
  artifacts: Schema.Array(ArtifactMetadata),
  indexedAt: IsoDateTime,
});
export type ArtifactListResult = typeof ArtifactListResult.Type;

export class ArtifactLibraryReadError extends Schema.TaggedErrorClass<ArtifactLibraryReadError>()(
  "ArtifactLibraryReadError",
  {
    detail: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return `Artifact library read failed: ${this.detail}`;
  }
}
