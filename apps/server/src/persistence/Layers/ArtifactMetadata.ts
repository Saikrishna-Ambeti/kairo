import {
  ArtifactMetadata,
  type OrchestrationV2Checkpoint,
  type ProjectId,
  TurnId,
} from "@kairo/contracts";
import * as DateTime from "effect/DateTime";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

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
      INNER JOIN orchestration_v2_projection_threads AS thread
        ON thread.thread_id = artifact.thread_id
      WHERE project.deleted_at IS NULL
        AND thread.deleted_at IS NULL
        AND (${input.threadId} IS NULL OR artifact.thread_id = ${input.threadId})
        AND (
          (${input.includeDocuments} = 1 AND artifact.kind = 'document')
          OR (${input.includePresentations} = 1 AND artifact.kind = 'presentation')
          OR (${input.includeSpreadsheets} = 1 AND artifact.kind = 'spreadsheet')
          OR (${input.includeCsv} = 1 AND artifact.kind = 'csv')
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

  const deleteAfterCheckpoint: ArtifactMetadataRepositoryShape["deleteAfterCheckpoint"] = (
    threadId,
    checkpointTurnCount,
  ) =>
    sql`DELETE FROM artifact_metadata WHERE thread_id = ${threadId}
      AND checkpoint_turn_count > ${checkpointTurnCount}`.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ArtifactMetadataRepository.deleteAfterCheckpoint")),
    );

  return { upsert, deletePath, deleteAfterCheckpoint, deleteByThreadId, deleteByProjectId, list };
});

export const ArtifactMetadataRepositoryLive = Layer.effect(
  ArtifactMetadataRepository,
  makeArtifactMetadataRepository,
);

const ARTIFACT_EXTENSIONS = {
  ".docx": "document",
  ".pptx": "presentation",
  ".xlsx": "spreadsheet",
  ".csv": "csv",
  ".pdf": "pdf",
} as const;

export const indexArtifactCheckpoint = Effect.fnUntraced(function* (input: {
  readonly projectId: ProjectId;
  readonly cwd: string;
  readonly checkpoint: OrchestrationV2Checkpoint;
}) {
  const { checkpoint } = input;
  if (checkpoint.runId === null || checkpoint.status !== "ready") return;
  const path = yield* Path.Path;
  const files = checkpoint.files.flatMap((file) => {
    const extension = path.extname(file.path).toLowerCase() as keyof typeof ARTIFACT_EXTENSIONS;
    return Object.hasOwn(ARTIFACT_EXTENSIONS, extension)
      ? [{ relativePath: file.path, kind: ARTIFACT_EXTENSIONS[extension] }]
      : [];
  });
  if (files.length === 0) return;
  const repository = yield* ArtifactMetadataRepository;
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(input.cwd).pipe(Effect.orElseSucceed(() => null));
  if (root === null) return;
  const turnId = TurnId.make(checkpoint.runId);
  const capturedAt = DateTime.formatIso(checkpoint.capturedAt);
  yield* Effect.forEach(
    files,
    ({ relativePath, kind }) =>
      Effect.gen(function* () {
        const canonical = yield* fs
          .realPath(path.resolve(root, relativePath))
          .pipe(Effect.orElseSucceed(() => null));
        const inRoot = canonical === null ? null : path.relative(root, canonical);
        const info =
          canonical !== null &&
          inRoot !== null &&
          inRoot !== ".." &&
          !inRoot.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(inRoot)
            ? yield* fs.stat(canonical).pipe(Effect.orElseSucceed(() => null))
            : null;
        if (info === null || info.type !== "File") {
          yield* repository.deletePath({ threadId: checkpoint.threadId, relativePath });
          return;
        }

        const fileName = path.basename(relativePath);
        const name = path
          .basename(relativePath, path.extname(relativePath))
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const title = name === "" ? "Untitled file" : `${name[0]?.toUpperCase()}${name.slice(1)}`;
        yield* repository.upsert({
          threadId: checkpoint.threadId,
          projectId: input.projectId,
          turnId,
          checkpointTurnCount: checkpoint.ordinalWithinScope,
          kind,
          title,
          fileName,
          relativePath,
          sizeBytes: Number(info.size),
          searchText: `${title} ${relativePath} ${kind}`.toLowerCase(),
          createdAt: capturedAt,
          updatedAt: capturedAt,
        });
      }),
    { concurrency: 4, discard: true },
  );
});
