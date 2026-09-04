import { ProjectId, ProviderInstanceId, ThreadId, TurnId } from "@kairo/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ArtifactMetadataRepository } from "../Services/ArtifactMetadata.ts";
import { ProjectionProjectRepository } from "../Services/ProjectionProjects.ts";
import { ProjectionThreadRepository } from "../Services/ProjectionThreads.ts";
import { ArtifactMetadataRepositoryLive } from "./ArtifactMetadata.ts";
import { ProjectionProjectRepositoryLive } from "./ProjectionProjects.ts";
import { ProjectionThreadRepositoryLive } from "./ProjectionThreads.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";

const artifactMetadataLayer = it.layer(
  Layer.mergeAll(
    ArtifactMetadataRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    ProjectionProjectRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    ProjectionThreadRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    SqlitePersistenceMemory,
  ),
);

artifactMetadataLayer("ArtifactMetadataRepository", (it) => {
  it.effect("searches metadata across projects and filters by artifact type", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectionProjectRepository;
      const threads = yield* ProjectionThreadRepository;
      const artifacts = yield* ArtifactMetadataRepository;
      const projectId = ProjectId.make("project-physics");
      const threadId = ThreadId.make("thread-thermodynamics");
      const createdAt = "2026-04-01T10:00:00.000Z";

      yield* projects.upsert({
        projectId,
        title: "Physics Lab",
        workspaceRoot: "/tmp/physics-lab",
        defaultModelSelection: null,
        defaultThreadEnvMode: null,
        autoPull: false,
        scripts: [],
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      });
      yield* threads.upsert({
        threadId,
        projectId,
        title: "Thermodynamics assignment",
        modelSelection: {
          instanceId: ProviderInstanceId.make("codex"),
          model: "gpt-5-codex",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurnId: null,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        unsettledAt: null,
        snoozedUntil: null,
        snoozedAt: null,
        pinnedAt: null,
        latestUserMessageAt: null,
        pendingApprovalCount: 0,
        pendingUserInputCount: 0,
        hasActionableProposedPlan: 0,
        deletedAt: null,
      });
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

      const byProject = yield* artifacts.list({
        threadId: null,
        queryLike: "%physics%",
        includeDocuments: 1,
        includePdfs: 1,
        limit: 20,
      });
      assert.deepEqual(
        byProject.map((artifact) => artifact.fileName),
        ["equation-sheet.pdf", "lab-report.docx"],
      );

      const documents = yield* artifacts.list({
        threadId,
        queryLike: null,
        includeDocuments: 1,
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
