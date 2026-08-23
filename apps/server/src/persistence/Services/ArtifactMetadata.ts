import {
  ArtifactKind,
  type ArtifactMetadata,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "@kairo/contracts";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const UpsertArtifactMetadataInput = Schema.Struct({
  threadId: ThreadId,
  projectId: ProjectId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  kind: ArtifactKind,
  title: TrimmedNonEmptyString,
  fileName: TrimmedNonEmptyString,
  relativePath: TrimmedNonEmptyString,
  sizeBytes: NonNegativeInt,
  searchText: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type UpsertArtifactMetadataInput = typeof UpsertArtifactMetadataInput.Type;

export const DeleteArtifactMetadataPathInput = Schema.Struct({
  threadId: ThreadId,
  relativePath: TrimmedNonEmptyString,
});
export type DeleteArtifactMetadataPathInput = typeof DeleteArtifactMetadataPathInput.Type;

export const ListArtifactMetadataInput = Schema.Struct({
  threadId: Schema.NullOr(ThreadId),
  queryLike: Schema.NullOr(Schema.String),
  includeDocuments: Schema.Literals([0, 1]),
  includePdfs: Schema.Literals([0, 1]),
  limit: NonNegativeInt,
});
export type ListArtifactMetadataInput = typeof ListArtifactMetadataInput.Type;

export interface ArtifactMetadataRepositoryShape {
  readonly upsert: (
    input: UpsertArtifactMetadataInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly deletePath: (
    input: DeleteArtifactMetadataPathInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly deleteByThreadId: (threadId: ThreadId) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly deleteByProjectId: (
    projectId: ProjectId,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly list: (
    input: ListArtifactMetadataInput,
  ) => Effect.Effect<ReadonlyArray<ArtifactMetadata>, ProjectionRepositoryError>;
}

export class ArtifactMetadataRepository extends Context.Service<
  ArtifactMetadataRepository,
  ArtifactMetadataRepositoryShape
>()("kairo/persistence/Services/ArtifactMetadata/ArtifactMetadataRepository") {}
