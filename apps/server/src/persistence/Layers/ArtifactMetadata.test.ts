import { ProjectId, ThreadId, TurnId } from "@kairo/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { ArtifactMetadataRepository } from "../Services/ArtifactMetadata.ts";
import { ArtifactMetadataRepositoryLive } from "./ArtifactMetadata.ts";
import * as Sqlite from "../Sqlite.ts";

const artifactMetadataLayer = it.layer(
  ArtifactMetadataRepositoryLive.pipe(Layer.provideMerge(Sqlite.layerMemory)),
);

artifactMetadataLayer("ArtifactMetadataRepository", (it) => {
  it.effect("searches metadata across projects and filters by artifact type", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const artifacts = yield* ArtifactMetadataRepository;
      const projectId = ProjectId.make("project-physics");
      const threadId = ThreadId.make("thread-thermodynamics");
      const createdAt = "2026-04-01T10:00:00.000Z";

      yield* sql`
        INSERT INTO projection_projects (project_id,title,workspace_root,scripts_json,created_at,updated_at)
        VALUES (${projectId},'Physics Lab','/tmp/physics-lab','[]',${createdAt},${createdAt})
      `;
      yield* sql`
        INSERT INTO orchestration_v2_projection_threads (
          thread_id,project_id,title,default_provider,runtime_mode,interaction_mode,created_at,updated_at,payload_json
        ) VALUES (
          ${threadId},${projectId},'Thermodynamics assignment','codex','full-access','default',${createdAt},${createdAt},'{}'
        )
      `;
      yield* artifacts.upsert({
        threadId,
        projectId,
        turnId: TurnId.make("turn-document"),
        checkpointTurnCount: 1,
        kind: "document",
        title: "Lab report",
        fileName: "lab-report.docx",
        relativePath: "artifacts/lab-report.docx",
        sizeBytes: 4096,
        searchText:
          "lab report lab-report.docx artifacts/lab-report.docx physics lab thermodynamics assignment document",
        createdAt,
        updatedAt: createdAt,
      });
      yield* artifacts.upsert({
        threadId,
        projectId,
        turnId: TurnId.make("turn-pdf"),
        checkpointTurnCount: 2,
        kind: "pdf",
        title: "Equation sheet",
        fileName: "equation-sheet.pdf",
        relativePath: "artifacts/equation-sheet.pdf",
        sizeBytes: 8192,
        searchText:
          "equation sheet equation-sheet.pdf artifacts/equation-sheet.pdf physics lab thermodynamics assignment pdf",
        createdAt,
        updatedAt: "2026-04-01T11:00:00.000Z",
      });
      yield* artifacts.upsert({
        threadId,
        projectId,
        turnId: TurnId.make("turn-presentation"),
        checkpointTurnCount: 3,
        kind: "presentation",
        title: "Lab slides",
        fileName: "lab-slides.pptx",
        relativePath: "artifacts/lab-slides.pptx",
        sizeBytes: 12288,
        searchText: "lab slides lab-slides.pptx artifacts/lab-slides.pptx physics lab presentation",
        createdAt,
        updatedAt: "2026-04-01T12:00:00.000Z",
      });

      const byProject = yield* artifacts.list({
        threadId: null,
        queryLike: "%physics%",
        includeDocuments: 1,
        includePresentations: 1,
        includeSpreadsheets: 1,
        includeCsv: 1,
        includePdfs: 1,
        limit: 20,
      });
      assert.deepEqual(
        byProject.map((artifact) => artifact.fileName),
        ["lab-slides.pptx", "equation-sheet.pdf", "lab-report.docx"],
      );

      const documents = yield* artifacts.list({
        threadId,
        queryLike: null,
        includeDocuments: 1,
        includePresentations: 0,
        includeSpreadsheets: 0,
        includeCsv: 0,
        includePdfs: 0,
        limit: 20,
      });
      assert.deepEqual(
        documents.map((artifact) => artifact.fileName),
        ["lab-report.docx"],
      );
      assert.equal(documents[0]?.projectTitle, "Physics Lab");
      assert.equal(documents[0]?.threadTitle, "Thermodynamics assignment");
    }),
  );
});
