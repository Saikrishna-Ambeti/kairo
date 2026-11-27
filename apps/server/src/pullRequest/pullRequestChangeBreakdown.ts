import type { PullRequestChangeBreakdown } from "@kairo/contracts";
import { summarizeChangedFiles } from "@kairo/shared/changedFileKind";
import type { ProviderFileStats } from "@kairo/source-control-core/server/PullRequestProvider";

export function toChangeBreakdown(stats: ProviderFileStats): PullRequestChangeBreakdown {
  if (stats.truncated) return null;
  return summarizeChangedFiles(stats.files);
}
