import * as Migrator from "effect/sql/Migrator";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as DatabaseMigrationProgress from "./DatabaseMigrationProgress.ts";
import {
  DATABASE_MIGRATION_PROGRESS_MESSAGE,
  DATABASE_MIGRATIONS_FINISHED_MESSAGE,
  DATABASE_MIGRATIONS_STARTED_MESSAGE,
} from "@kairo/shared/databaseMigrationLog";

import Migration0001 from "./Migrations/001_OrchestrationEvents.ts";
import Migration0002 from "./Migrations/002_OrchestrationCommandReceipts.ts";
import Migration0003 from "./Migrations/003_CheckpointDiffBlobs.ts";
import Migration0004 from "./Migrations/004_ProviderSessionRuntime.ts";
import Migration0005 from "./Migrations/005_Projections.ts";
import Migration0006 from "./Migrations/006_ProjectionThreadSessionRuntimeModeColumns.ts";
import Migration0007 from "./Migrations/007_ProjectionThreadMessageAttachments.ts";
import Migration0008 from "./Migrations/008_ProjectionThreadActivitySequence.ts";
import Migration0009 from "./Migrations/009_ProviderSessionRuntimeMode.ts";
import Migration0010 from "./Migrations/010_ProjectionThreadsRuntimeMode.ts";
import Migration0011 from "./Migrations/011_OrchestrationThreadCreatedRuntimeMode.ts";
import Migration0012 from "./Migrations/012_ProjectionThreadsInteractionMode.ts";
import Migration0013 from "./Migrations/013_ProjectionThreadProposedPlans.ts";
import Migration0014 from "./Migrations/014_ProjectionThreadProposedPlanImplementation.ts";
import Migration0015 from "./Migrations/015_ProjectionTurnsSourceProposedPlan.ts";
import Migration0016 from "./Migrations/016_CanonicalizeModelSelections.ts";
import Migration0017 from "./Migrations/017_ProjectionThreadsArchivedAt.ts";
import Migration0018 from "./Migrations/018_ProjectionThreadsArchivedAtIndex.ts";
import Migration0019 from "./Migrations/019_ProjectionSnapshotLookupIndexes.ts";
import Migration0020 from "./Migrations/020_AuthAccessManagement.ts";
import Migration0021 from "./Migrations/021_AuthSessionClientMetadata.ts";
import Migration0022 from "./Migrations/022_AuthSessionLastConnectedAt.ts";
import Migration0023 from "./Migrations/023_ProjectionThreadShellSummary.ts";
import Migration0024 from "./Migrations/024_BackfillProjectionThreadShellSummary.ts";
import Migration0025 from "./Migrations/025_CleanupInvalidProjectionPendingApprovals.ts";
import Migration0026 from "./Migrations/026_CanonicalizeModelSelectionOptions.ts";
import Migration0027 from "./Migrations/027_ProviderSessionRuntimeInstanceId.ts";
import Migration0028 from "./Migrations/028_ProjectionThreadSessionInstanceId.ts";
import Migration0029 from "./Migrations/029_ProjectionThreadDetailOrderingIndexes.ts";
import Migration0030 from "./Migrations/030_ProjectionThreadShellArchiveIndexes.ts";
import Migration0031 from "./Migrations/031_AuthAuthorizationScopes.ts";
import Migration0032 from "./Migrations/032_AuthPairingProofKeyThumbprint.ts";
import Migration0033 from "./Migrations/033_ProjectionThreadsSettled.ts";
import Migration0034 from "./Migrations/034_ProjectionThreadsSnoozed.ts";
import Migration0035 from "./Migrations/035_ProjectionThreadTitleRegeneration.ts";
import Migration0036 from "./Migrations/036_ProjectionThreadsPinned.ts";
import Migration0037 from "./Migrations/037_ProjectionTurnsKeysetIndex.ts";
import Migration0038 from "./Migrations/038_ProjectionThreadsPinOrderKey.ts";
import Migration0039 from "./Migrations/039_ProjectionProjectsDefaultThreadEnvMode.ts";
import Migration0040 from "./Migrations/040_ProjectionProjectFaviconPath.ts";
import Migration0041 from "./Migrations/041_AuthSessionClientConnection.ts";
import Migration0042 from "./Migrations/042_ProjectionThreadLinkedPullRequest.ts";
import Migration0043 from "./Migrations/043_ProjectionThreadsUnsettledAt.ts";
import Migration0044 from "./Migrations/044_ClearAutomaticProjectModelDefaults.ts";
import Migration0045 from "./Migrations/045_ProjectionProjectsAutoPull.ts";
import Migration0046 from "./Migrations/046_RepairAutomaticSettlementTimestamps.ts";
import Migration0047 from "./Migrations/047_ProjectionProjectIcon.ts";
import Migration0048 from "./Migrations/048_KairoUpstreamSchemaReconciliation.ts";
import Migration0049 from "./Migrations/049_ArtifactMetadata.ts";
import Migration0050 from "./Migrations/050_ScheduledTasks.ts";
import Migration0051 from "./Migrations/051_ProjectionThreadBranchPullRequest.ts";
import Migration0052 from "./Migrations/052_ProjectionThreadsActiveOrderKey.ts";
import Migration0053 from "./Migrations/053_ProjectionThreadPullRequests.ts";
import Migration0054 from "./Migrations/054_ProjectionThreadMessageContext.ts";
import Migration0055 from "./Migrations/055_ProjectionThreadTitleState.ts";
import Migration0056 from "./Migrations/056_PullRequestFilesViewed.ts";
import Migration0057 from "./Migrations/057_ProjectionThreadsAutoSettleDisabledAt.ts";
import Migration0058 from "./Migrations/058_ArtifactFileKinds.ts";
import Migration0059 from "./Migrations/059_BackfillArtifactFileKinds.ts";
import Migration0060 from "./Migrations/060_KairoThreadSchemaReconciliation.ts";
import Migration0061 from "./Migrations/061_ArchiveKairoScheduledTasks.ts";
import Migration0062 from "./Migrations/062_OrchestrationV2.ts";
import Migration0063 from "./Migrations/063_RemoveRedundantProjectionIndexes.ts";
import Migration0064 from "./Migrations/064_ScheduledTaskWebhooks.ts";
import Migration0065 from "./Migrations/065_WebhookRelayDeliveries.ts";
import Migration0066 from "./Migrations/066_McpAppModelContext.ts";
import Migration0067 from "./Migrations/067_ThreadSnapshotWindowIndexes.ts";
import Migration0068 from "./Migrations/068_PullRequestReviewGuides.ts";
import Migration0069 from "./Migrations/069_ThreadFailureLookupIndex.ts";
import Migration0070 from "./Migrations/070_DropUnusedV1Projections.ts";
import Migration0071 from "./Migrations/071_CanonicalizeThreadPullRequestLinks.ts";
import Migration0072 from "./Migrations/072_CodexUsageNativeTurnIndex.ts";
import Migration0073 from "./Migrations/073_RepairClientSettlementTimestamps.ts";
import Migration0074 from "./Migrations/074_WebhookDedupe.ts";
import Migration0075 from "./Migrations/075_ShellStopRequestIndex.ts";
import Migration0076 from "./Migrations/076_ThreadMessageSearch.ts";
import Migration0077 from "./Migrations/077_PeerLinks.ts";
import Migration0078 from "./Migrations/078_PeerLinkFence.ts";
import Migration0079 from "./Migrations/079_WaitingLinkRequestIndex.ts";
import Migration0080 from "./Migrations/080_ActiveTurnItemIndexes.ts";
import Migration0081 from "./Migrations/081_ExcludeAttachmentPlaceholdersFromSearch.ts";
import Migration0082 from "./Migrations/082_SubagentDeliveryState.ts";
import Migration0083 from "./Migrations/083_ProjectionProjectsPinArchive.ts";
import Migration0084 from "./Migrations/084_RepairBooleanSettledOverride.ts";
import Migration0085 from "./Migrations/085_DropOrchestrationEventCorrelationIndex.ts";
import Migration0086 from "./Migrations/086_DelegatedRecoveryIndexes.ts";
import Migration0087 from "./Migrations/087_ScheduledTaskThreadMode.ts";
import Migration0088 from "./Migrations/088_ProjectionMessageSearchText.ts";
import Migration0089 from "./Migrations/089_TurnItemConversationIndex.ts";
import Migration0090 from "./Migrations/090_CommandReadIndexes.ts";
import Migration0091 from "./Migrations/091_LastExecutedRunIndex.ts";
import Migration0092 from "./Migrations/092_TurnItemCounts.ts";
import Migration0093 from "./Migrations/093_QueuedTurnInputIndex.ts";
import Migration0094 from "./Migrations/094_ProjectionProjectsCustomTitle.ts";
import Migration0095 from "./Migrations/095_TurnItemTypeStatusIndex.ts";
import Migration0096 from "./Migrations/096_ShellThreadReadIndexes.ts";
import Migration0097 from "./Migrations/097_AuthConnectDevices.ts";
import Migration0098 from "./Migrations/098_AuthConnectDeniedRequests.ts";
import Migration0099 from "./Migrations/099_QueuedTurnInputIndexJsonValid.ts";
import Migration0100 from "./Migrations/100_ProviderTurnAttemptIndex.ts";
import Migration0101 from "./Migrations/101_TurnItemMessageOrdinalIndex.ts";
import Migration0102 from "./Migrations/102_TurnItemInlineWorkOutput.ts";
import Migration0103 from "./Migrations/103_RepairStaleTitleRegeneration.ts";
import Migration0104 from "./Migrations/104_IssueTrackerBindings.ts";
import Migration0105 from "./Migrations/105_ActiveShellIndexIndexes.ts";
import Migration0106 from "./Migrations/106_BackgroundRecoveryIndexes.ts";
import Migration0107 from "./Migrations/107_TurnStartReadIndexes.ts";
import Migration0108 from "./Migrations/108_DelegatedTaskReadIndexes.ts";
import Migration0109 from "./Migrations/109_ThreadItemCounts.ts";
import Migration0110 from "./Migrations/110_IssueTrackerAdditionalScopes.ts";
import Migration0111 from "./Migrations/111_ProjectionProjectsTrackedFolders.ts";
import Migration0112 from "./Migrations/112_TaskFolders.ts";
import Migration0113 from "./Migrations/113_WorktreePathKeyIndex.ts";
import Migration0114 from "./Migrations/114_DeferredSlashCommandIndex.ts";
import Migration0115 from "./Migrations/115_AgentFeedback.ts";
import Migration0116 from "./Migrations/116_IssueTrackerAccounts.ts";
import Migration0117 from "./Migrations/117_Workflows.ts";
import Migration0118 from "./Migrations/118_SupersededRunAttemptIndex.ts";
import Migration0119 from "./Migrations/119_LayoutCommandApprovals.ts";
import Migration0120 from "./Migrations/120_WorkflowSkippedRuns.ts";
import Migration0121 from "./Migrations/121_WorkflowRunIndexes.ts";
import Migration0122 from "./Migrations/122_WorkflowRunTags.ts";
import Migration0123 from "./Migrations/123_ForkHistoryMembership.ts";
import Migration0124 from "./Migrations/124_WorkflowMailSender.ts";
import Migration0125 from "./Migrations/125_WorkflowPools.ts";
import Migration0126 from "./Migrations/126_WorkflowRunSubject.ts";
import Migration0127 from "./Migrations/127_ImportKairoScheduledTasks.ts";

const migrationEntries = [
  [1, "OrchestrationEvents", Migration0001],
  [2, "OrchestrationCommandReceipts", Migration0002],
  [3, "CheckpointDiffBlobs", Migration0003],
  [4, "ProviderSessionRuntime", Migration0004],
  [5, "Projections", Migration0005],
  [6, "ProjectionThreadSessionRuntimeModeColumns", Migration0006],
  [7, "ProjectionThreadMessageAttachments", Migration0007],
  [8, "ProjectionThreadActivitySequence", Migration0008],
  [9, "ProviderSessionRuntimeMode", Migration0009],
  [10, "ProjectionThreadsRuntimeMode", Migration0010],
  [11, "OrchestrationThreadCreatedRuntimeMode", Migration0011],
  [12, "ProjectionThreadsInteractionMode", Migration0012],
  [13, "ProjectionThreadProposedPlans", Migration0013],
  [14, "ProjectionThreadProposedPlanImplementation", Migration0014],
  [15, "ProjectionTurnsSourceProposedPlan", Migration0015],
  [16, "CanonicalizeModelSelections", Migration0016],
  [17, "ProjectionThreadsArchivedAt", Migration0017],
  [18, "ProjectionThreadsArchivedAtIndex", Migration0018],
  [19, "ProjectionSnapshotLookupIndexes", Migration0019],
  [20, "AuthAccessManagement", Migration0020],
  [21, "AuthSessionClientMetadata", Migration0021],
  [22, "AuthSessionLastConnectedAt", Migration0022],
  [23, "ProjectionThreadShellSummary", Migration0023],
  [24, "BackfillProjectionThreadShellSummary", Migration0024],
  [25, "CleanupInvalidProjectionPendingApprovals", Migration0025],
  [26, "CanonicalizeModelSelectionOptions", Migration0026],
  [27, "ProviderSessionRuntimeInstanceId", Migration0027],
  [28, "ProjectionThreadSessionInstanceId", Migration0028],
  [29, "ProjectionThreadDetailOrderingIndexes", Migration0029],
  [30, "ProjectionThreadShellArchiveIndexes", Migration0030],
  [31, "AuthAuthorizationScopes", Migration0031],
  [32, "AuthPairingProofKeyThumbprint", Migration0032],
  [33, "ProjectionThreadsSettled", Migration0033],
  [34, "ProjectionThreadsSnoozed", Migration0034],
  [35, "ProjectionThreadTitleRegeneration", Migration0035],
  [36, "ProjectionThreadsPinned", Migration0036],
  [37, "ProjectionTurnsKeysetIndex", Migration0037],
  [38, "ProjectionThreadsPinOrderKey", Migration0038],
  [39, "ProjectionProjectsDefaultThreadEnvMode", Migration0039],
  [40, "ProjectionProjectFaviconPath", Migration0040],
  [41, "AuthSessionClientConnection", Migration0041],
  [42, "ProjectionThreadLinkedPullRequest", Migration0042],
  [43, "ProjectionThreadsUnsettledAt", Migration0043],
  [44, "ClearAutomaticProjectModelDefaults", Migration0044],
  [45, "ProjectionProjectsAutoPull", Migration0045],
  [46, "RepairAutomaticSettlementTimestamps", Migration0046],
  [47, "ProjectionProjectIcon", Migration0047],
  [48, "KairoUpstreamSchemaReconciliation", Migration0048],
  [49, "ArtifactMetadata", Migration0049],
  [50, "ScheduledTasks", Migration0050],
  [51, "ProjectionThreadBranchPullRequest", Migration0051],
  [52, "ProjectionThreadsActiveOrderKey", Migration0052],
  [53, "ProjectionThreadPullRequests", Migration0053],
  [54, "ProjectionThreadMessageContext", Migration0054],
  [55, "ProjectionThreadTitleState", Migration0055],
  [56, "PullRequestFilesViewed", Migration0056],
  [57, "ProjectionThreadsAutoSettleDisabledAt", Migration0057],
  [58, "ArtifactFileKinds", Migration0058],
  [59, "BackfillArtifactFileKinds", Migration0059],
  [60, "KairoThreadSchemaReconciliation", Migration0060],
  [61, "ArchiveKairoScheduledTasks", Migration0061],
  // Preserve this migration's schema. Future V2 schema changes need new migrations.
  [62, "OrchestrationV2", Migration0062],
  [63, "RemoveRedundantProjectionIndexes", Migration0063],
  [64, "ScheduledTaskWebhooks", Migration0064],
  [65, "WebhookRelayDeliveries", Migration0065],
  [66, "McpAppModelContext", Migration0066],
  [67, "ThreadSnapshotWindowIndexes", Migration0067],
  [68, "PullRequestReviewGuides", Migration0068],
  [69, "ThreadFailureLookupIndex", Migration0069],
  [70, "DropUnusedV1Projections", Migration0070],
  [71, "CanonicalizeThreadPullRequestLinks", Migration0071],
  [72, "CodexUsageNativeTurnIndex", Migration0072],
  [73, "RepairClientSettlementTimestamps", Migration0073],
  [74, "WebhookDedupe", Migration0074],
  [75, "ShellStopRequestIndex", Migration0075],
  [76, "ThreadMessageSearch", Migration0076],
  [77, "PeerLinks", Migration0077],
  [78, "PeerLinkFence", Migration0078],
  [79, "WaitingLinkRequestIndex", Migration0079],
  [80, "ActiveTurnItemIndexes", Migration0080],
  [81, "ExcludeAttachmentPlaceholdersFromSearch", Migration0081],
  [82, "SubagentDeliveryState", Migration0082],
  [83, "ProjectionProjectsPinArchive", Migration0083],
  [84, "RepairBooleanSettledOverride", Migration0084],
  [85, "DropOrchestrationEventCorrelationIndex", Migration0085],
  [86, "DelegatedRecoveryIndexes", Migration0086],
  [87, "ScheduledTaskThreadMode", Migration0087],
  [88, "ProjectionMessageSearchText", Migration0088],
  [89, "TurnItemConversationIndex", Migration0089],
  [90, "CommandReadIndexes", Migration0090],
  [91, "LastExecutedRunIndex", Migration0091],
  [92, "TurnItemCounts", Migration0092],
  [93, "QueuedTurnInputIndex", Migration0093],
  [94, "ProjectionProjectsCustomTitle", Migration0094],
  [95, "TurnItemTypeStatusIndex", Migration0095],
  [96, "ShellThreadReadIndexes", Migration0096],
  [97, "AuthConnectDevices", Migration0097],
  [98, "AuthConnectDeniedRequests", Migration0098],
  [99, "QueuedTurnInputIndexJsonValid", Migration0099],
  [100, "ProviderTurnAttemptIndex", Migration0100],
  [101, "TurnItemMessageOrdinalIndex", Migration0101],
  [102, "TurnItemInlineWorkOutput", Migration0102],
  [103, "RepairStaleTitleRegeneration", Migration0103],
  [104, "IssueTrackerBindings", Migration0104],
  [105, "ActiveShellIndexIndexes", Migration0105],
  [106, "BackgroundRecoveryIndexes", Migration0106],
  [107, "TurnStartReadIndexes", Migration0107],
  [108, "DelegatedTaskReadIndexes", Migration0108],
  [109, "ThreadItemCounts", Migration0109],
  [110, "IssueTrackerAdditionalScopes", Migration0110],
  [111, "ProjectionProjectsTrackedFolders", Migration0111],
  [112, "TaskFolders", Migration0112],
  [113, "WorktreePathKeyIndex", Migration0113],
  [114, "DeferredSlashCommandIndex", Migration0114],
  [115, "AgentFeedback", Migration0115],
  [116, "IssueTrackerAccounts", Migration0116],
  [117, "Workflows", Migration0117],
  [118, "SupersededRunAttemptIndex", Migration0118],
  [119, "LayoutCommandApprovals", Migration0119],
  [120, "WorkflowSkippedRuns", Migration0120],
  [121, "WorkflowRunIndexes", Migration0121],
  [122, "WorkflowRunTags", Migration0122],
  [123, "ForkHistoryMembership", Migration0123],
  [124, "WorkflowMailSender", Migration0124],
  [125, "WorkflowPools", Migration0125],
  [126, "WorkflowRunSubject", Migration0126],
  [127, "ImportKairoScheduledTasks", Migration0127],
] as const;

export const migrationManifest = migrationEntries.map(([id, name]) => [id, name] as const);

const makeMigrationLoader = (throughId?: number) =>
  Migrator.fromRecord(
    Object.fromEntries(
      migrationEntries
        .filter(([id]) => throughId === undefined || id <= throughId)
        .map(([id, name, migration]) => [`${id}_${name}`, migration]),
    ),
  );

const FIRST_V2_MIGRATION_ID = 62;

export function skippedV2Migrations(
  recorded: ReadonlyArray<{ readonly id: number; readonly name: string }>,
  throughId?: number,
): string[] {
  const latestRecordedId = Math.max(0, ...recorded.map((row) => row.id));
  const recordedNames = new Map(recorded.map((row) => [row.id, row.name]));
  const foreignV2 = recorded.find(
    (row) => row.name === "OrchestrationV2" && row.id < FIRST_V2_MIGRATION_ID,
  );
  if (foreignV2) return [`${foreignV2.id}_${foreignV2.name} (created by another build)`];
  return migrationManifest.flatMap(([id, name]) => {
    if (
      id < FIRST_V2_MIGRATION_ID ||
      id > latestRecordedId ||
      (throughId !== undefined && id > throughId)
    )
      return [];
    const recordedName = recordedNames.get(id);
    return recordedName === name ? [] : [`${id}_${name} (recorded: ${recordedName ?? "nothing"})`];
  });
}

// Migrators skip ids up to the highest recorded; reject collisions that would skip V2 schema.
const assertV2MigrationsCanRun = Effect.fn("assertV2MigrationsCanRun")(function* (
  throughId?: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const tables = yield* sql`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'effect_sql_migrations'
  `;
  if (tables.length === 0) return;
  const recorded = yield* sql<{
    readonly migration_id: number;
    readonly name: string;
  }>`SELECT migration_id, name FROM effect_sql_migrations`;
  const skipped = skippedV2Migrations(
    recorded.map((row) => ({ id: row.migration_id, name: row.name })),
    throughId,
  );
  const latestRecordedId = Math.max(0, ...recorded.map((row) => row.migration_id));
  if (skipped.length === 0) return;
  return yield* new Migrator.MigrationError({
    kind: "BadState",
    message: `This database's migration history would skip required schema migrations: ${skipped.join(", ")}. The migrator skips every id up to the highest recorded id (${latestRecordedId}), regardless of name. It was probably written by a different build. Start the build that wrote it, or report this migration history so an upgrade path can be added.`,
  });
});

const latestMigrationId = Math.max(...migrationEntries.map(([id]) => id));

// Mirrors the Migrator and detects incompatible ledgers before startup.
export const hasPendingMigrations = Effect.fn("hasPendingMigrations")(function* () {
  const sql = yield* SqlClient.SqlClient;
  const tables = yield* sql`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'effect_sql_migrations'
  `;
  if (tables.length === 0) return true;
  const rows = yield* sql<{ readonly latestId: number | null; readonly foreignV2Rows: number }>`
    SELECT
      MAX(migration_id) AS latestId,
      SUM(name = 'OrchestrationV2' AND migration_id BETWEEN 53 AND 61) AS foreignV2Rows
    FROM effect_sql_migrations
  `;
  const row = rows[0];
  return (row?.latestId ?? 0) < latestMigrationId || (row?.foreignV2Rows ?? 0) > 0;
});

const run = Migrator.make({});

export interface RunMigrationsOptions {
  readonly toMigrationInclusive?: number | undefined;
}

export const runMigrations = Effect.fn("runMigrations")(function* ({
  toMigrationInclusive,
}: RunMigrationsOptions = {}) {
  const progress = yield* Effect.serviceOption(DatabaseMigrationProgress.DatabaseMigrationProgress);
  // The desktop waits past its readiness budget until the finished line follows this one.
  const hasPending = yield* hasPendingMigrations();
  if (hasPending) yield* Effect.log(DATABASE_MIGRATIONS_STARTED_MESSAGE);
  const includesV2 =
    toMigrationInclusive === undefined || toMigrationInclusive >= FIRST_V2_MIGRATION_ID;
  if (includesV2) {
    yield* assertV2MigrationsCanRun(toMigrationInclusive);
  }
  const sql = yield* SqlClient.SqlClient;
  const ledger = yield* sql`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'effect_sql_migrations'
  `;
  const [latest] =
    ledger.length === 0
      ? []
      : yield* sql<{
          readonly id: number | null;
        }>`SELECT MAX(migration_id) AS id FROM effect_sql_migrations`;
  const latestRecordedId = latest?.id ?? 0;
  const pending = migrationEntries.filter(
    ([id]) =>
      id > latestRecordedId && (toMigrationInclusive === undefined || id <= toMigrationInclusive),
  );
  // One transaction per migration: an index build on a large database can take minutes, and a
  // restart then resumes after the last finished migration instead of rolling all of them back.
  const executedMigrations: Array<readonly [id: number, name: string]> = [];
  yield* Effect.gen(function* () {
    for (const [index, [id, name]] of pending.entries()) {
      if (Option.isSome(progress)) {
        yield* Ref.set(progress.value.current, { current: index + 1, total: pending.length });
      }
      if (latestRecordedId > 0) {
        yield* Effect.log(
          `${DATABASE_MIGRATION_PROGRESS_MESSAGE} (${index + 1} of ${pending.length})`,
        ).pipe(
          Effect.annotateLogs({
            migration: `${id}_${name}`,
            progress: `${index + 1} of ${pending.length}`,
          }),
        );
      }
      executedMigrations.push(...(yield* run({ loader: makeMigrationLoader(id) })));
    }
  }).pipe(
    Effect.ensuring(Option.isSome(progress) ? Ref.set(progress.value.current, null) : Effect.void),
  );
  const migrations = executedMigrations.map(([id, name]) => `${id}_${name}`);
  yield* migrations.length === 0
    ? Effect.logDebug("Database schema is current")
    : Effect.log(DATABASE_MIGRATIONS_FINISHED_MESSAGE).pipe(Effect.annotateLogs({ migrations }));

  const recorded = yield* sql<{
    readonly migration_id: number;
    readonly name: string;
  }>`SELECT migration_id, name FROM effect_sql_migrations`;
  const manifestNames = new Map<number, string>(migrationEntries.map(([id, name]) => [id, name]));
  const divergent = recorded.flatMap((row) => {
    const expected = manifestNames.get(row.migration_id);
    if (expected === undefined) {
      return [`${row.migration_id}:${row.name} (unknown to this build)`];
    }
    return expected === row.name
      ? []
      : [`${row.migration_id}:${row.name} (this build: ${expected})`];
  });
  if (divergent.length > 0) {
    yield* Effect.logWarning(
      "Database migration history diverges from this build; recorded migration ids are skipped, not reconciled by name.",
    ).pipe(Effect.annotateLogs({ divergent }));
  }
  return executedMigrations;
});
