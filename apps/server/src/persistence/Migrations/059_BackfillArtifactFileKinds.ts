import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as SqlClient from "effect/unstable/sql/SqlClient";

interface Candidate {
  readonly threadId: string;
  readonly projectId: string;
  readonly turnId: string;
  readonly checkpointTurnCount: number;
  readonly relativePath: string;
  readonly changeKind: string;
  readonly completedAt: string;
  readonly projectTitle: string;
  readonly threadTitle: string;
  readonly workspaceRoot: string;
  readonly worktreePath: string | null;
}

const fileKind = (relativePath: string) => {
  const extension = /\.[^.]+$/.exec(relativePath)?.[0]?.toLowerCase();
  if (extension === ".pptx") return "presentation";
  if (extension === ".xlsx") return "spreadsheet";
  if (extension === ".csv") return "csv";
  return null;
};

const isInside = (path: Path.Path, root: string, file: string) => {
  const relative = path.relative(root, file);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith("../") &&
    !relative.startsWith("..\\") &&
    !path.isAbsolute(relative)
  );
};

const backfill = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = yield* sql<Candidate>`
    WITH changed_files AS (
      SELECT
        thread.thread_id AS "threadId",
        thread.project_id AS "projectId",
        turn.turn_id AS "turnId",
        turn.checkpoint_turn_count AS "checkpointTurnCount",
        json_extract(file.value, '$.path') AS "relativePath",
        json_extract(file.value, '$.kind') AS "changeKind",
        turn.completed_at AS "completedAt",
        project.title AS "projectTitle",
        thread.title AS "threadTitle",
        project.workspace_root AS "workspaceRoot",
        thread.worktree_path AS "worktreePath",
        ROW_NUMBER() OVER (
          PARTITION BY thread.thread_id, json_extract(file.value, '$.path')
          ORDER BY turn.checkpoint_turn_count DESC, turn.row_id DESC
        ) AS rank
      FROM projection_turns AS turn
      INNER JOIN projection_threads AS thread ON thread.thread_id = turn.thread_id
      INNER JOIN projection_projects AS project ON project.project_id = thread.project_id
      JOIN json_each(turn.checkpoint_files_json) AS file
      WHERE thread.deleted_at IS NULL
        AND project.deleted_at IS NULL
        AND turn.turn_id IS NOT NULL
        AND turn.completed_at IS NOT NULL
        AND turn.checkpoint_turn_count IS NOT NULL
        AND (
          LOWER(json_extract(file.value, '$.path')) LIKE '%.pptx'
          OR LOWER(json_extract(file.value, '$.path')) LIKE '%.xlsx'
          OR LOWER(json_extract(file.value, '$.path')) LIKE '%.csv'
        )
    )
    SELECT * FROM changed_files WHERE rank = 1 AND "changeKind" != 'deleted'
  `;

  for (const candidate of candidates) {
    const relativePath = candidate.relativePath.replaceAll("\\", "/");
    const kind = fileKind(relativePath);
    if (kind === null) continue;
    const root = path.resolve(candidate.worktreePath ?? candidate.workspaceRoot);
    const absolutePath = path.resolve(root, relativePath);
    if (!isInside(path, root, absolutePath)) continue;

    const info = yield* Effect.all([
      fs.realPath(root),
      fs.realPath(absolutePath),
      fs.stat(absolutePath),
    ]).pipe(
      Effect.map(([realRoot, realFile, stat]) =>
        isInside(path, realRoot, realFile) && stat.type === "File" ? stat : null,
      ),
      Effect.orElseSucceed(() => null),
    );
    if (info === null) continue;

    const fileName = path.basename(relativePath);
    const stem = fileName
      .replace(/\.(?:pptx|xlsx|csv)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    const title = stem ? `${stem[0]!.toUpperCase()}${stem.slice(1)}` : "Untitled file";
    const searchText = [
      title,
      fileName,
      relativePath,
      candidate.projectTitle,
      candidate.threadTitle,
      kind,
    ]
      .join(" ")
      .toLowerCase();

    yield* sql`
      INSERT OR IGNORE INTO artifact_metadata (
        thread_id, project_id, turn_id, checkpoint_turn_count, kind, title,
        file_name, relative_path, size_bytes, search_text, created_at, updated_at
      ) VALUES (
        ${candidate.threadId}, ${candidate.projectId}, ${candidate.turnId},
        ${candidate.checkpointTurnCount}, ${kind}, ${title}, ${fileName},
        ${relativePath}, ${info.size}, ${searchText}, ${candidate.completedAt},
        ${candidate.completedAt}
      )
    `;
  }
});

export default backfill.pipe(Effect.provide(NodeServices.layer));
