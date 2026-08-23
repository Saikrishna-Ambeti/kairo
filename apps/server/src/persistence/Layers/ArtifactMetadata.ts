import { ArtifactMetadata } from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ArtifactMetadataRepository,
  DeleteArtifactMetadataPathInput,
  ListArtifactMetadataInput,
  type ArtifactMetadataRepositoryShape,
  UpsertArtifactMetadataInput,
} from "../Services/ArtifactMetadata.ts";

const makeArtifactMetadataRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: UpsertArtifactMetadataInput,
    execute: (row) => sql`
      INSERT INTO artifact_metadata (
        thread_id,
        project_id,
        turn_id,
        checkpoint_turn_count,
        kind,
        title,
        file_name,
        relative_path,
        size_bytes,
        search_text,
        created_at,
        updated_at
      )
      VALUES (
        ${row.threadId},
        ${row.projectId},
        ${row.turnId},
        ${row.checkpointTurnCount},
        ${row.kind},
        ${row.title},
        ${row.fileName},
        ${row.relativePath},
        ${row.sizeBytes},
        ${row.searchText},
        ${row.createdAt},
        ${row.updatedAt}
      )
      ON CONFLICT (thread_id, relative_path)
      DO UPDATE SET
        project_id = excluded.project_id,
        turn_id = excluded.turn_id,
        checkpoint_turn_count = excluded.checkpoint_turn_count,
        kind = excluded.kind,
        title = excluded.title,
        file_name = excluded.file_name,
        size_bytes = excluded.size_bytes,
        search_text = excluded.search_text,
        updated_at = excluded.updated_at
    `,
  });

  const deletePathRow = SqlSchema.void({
    Request: DeleteArtifactMetadataPathInput,
    execute: ({ threadId, relativePath }) => sql`
      DELETE FROM artifact_metadata
      WHERE thread_id = ${threadId}
        AND relative_path = ${relativePath}
    `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListArtifactMetadataInput,
    Result: ArtifactMetadata,
    execute: (input) => sql`
      SELECT
        artifact.project_id AS "projectId",
        project.title AS "projectTitle",
        artifact.thread_id AS "threadId",
        thread.title AS "threadTitle",
        artifact.turn_id AS "turnId",
        artifact.kind,
        artifact.title,
        artifact.file_name AS "fileName",
        artifact.relative_path AS "relativePath",
        artifact.size_bytes AS "sizeBytes",
        artifact.created_at AS "createdAt",
        artifact.updated_at AS "updatedAt"
      FROM artifact_metadata AS artifact
      INNER JOIN projection_projects AS project
        ON project.project_id = artifact.project_id
      INNER JOIN projection_threads AS thread
        ON thread.thread_id = artifact.thread_id
      WHERE project.deleted_at IS NULL
        AND thread.deleted_at IS NULL
        AND (${input.threadId} IS NULL OR artifact.thread_id = ${input.threadId})
        AND (
          (${input.includeDocuments} = 1 AND artifact.kind = 'document')
          OR (${input.includePdfs} = 1 AND artifact.kind = 'pdf')
        )
        AND (
          ${input.queryLike} IS NULL
          OR artifact.search_text LIKE ${input.queryLike}
          OR LOWER(project.title) LIKE ${input.queryLike}
          OR LOWER(thread.title) LIKE ${input.queryLike}
        )
      ORDER BY artifact.updated_at DESC, artifact.file_name ASC
      LIMIT ${input.limit}
    `,
  });

  const upsert: ArtifactMetadataRepositoryShape["upsert"] = (input) =>
    upsertRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.upsert:query")),
    );
  const deletePath: ArtifactMetadataRepositoryShape["deletePath"] = (input) =>
    deletePathRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.deletePath:query")),
    );
  const deleteByThreadId: ArtifactMetadataRepositoryShape["deleteByThreadId"] = (threadId) =>
    sql`DELETE FROM artifact_metadata WHERE thread_id = ${threadId}`.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.deleteByThreadId:query")),
    );
  const deleteByProjectId: ArtifactMetadataRepositoryShape["deleteByProjectId"] = (projectId) =>
    sql`DELETE FROM artifact_metadata WHERE project_id = ${projectId}`.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.deleteByProjectId:query")),
    );
  const list: ArtifactMetadataRepositoryShape["list"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.list:query")),
    );

  return { upsert, deletePath, deleteByThreadId, deleteByProjectId, list };
});

export const ArtifactMetadataRepositoryLive = Layer.effect(
  ArtifactMetadataRepository,
  makeArtifactMetadataRepository,
);
