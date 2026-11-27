import { makeThreadPullRequests } from "@kairo/source-control-core/shared/threadPullRequests";

import { sourceControlDefinitions } from "./sourceControlDefinitions.ts";

export { visibleThreadPullRequests } from "@kairo/shared/threadPullRequests";

export const {
  normalizeThreadPullRequestKey,
  legacyThreadPullRequestKey,
  threadPullRequestKeysEqual,
  threadPullRequestKeyOf,
  resolveThreadPullRequestChains,
  threadPullRequestsOf,
  applyThreadPullRequestLinkUpdate,
} = makeThreadPullRequests(sourceControlDefinitions);
