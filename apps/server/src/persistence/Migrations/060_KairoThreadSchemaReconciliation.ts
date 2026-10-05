import * as Effect from "effect/Effect";

import migrateBranchPullRequest from "./048_ProjectionThreadBranchPullRequest.ts";
import migrateActiveOrderKey from "./049_ProjectionThreadsActiveOrderKey.ts";

// Earlier Kairo builds recorded artifact migrations at IDs 51 and 52, skipping
// the projection columns now assigned those IDs. Replay their idempotent migrations
// at a new ID so databases already upgraded through 59 are repaired too.
export default Effect.gen(function* () {
  yield* migrateBranchPullRequest;
  yield* migrateActiveOrderKey;
});
