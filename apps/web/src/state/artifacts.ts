import type { ArtifactListInput, ArtifactListResult, EnvironmentId } from "@kairo/contracts";

import { serverEnvironment } from "./server";
import { useEnvironmentQuery } from "./query";

export function useArtifacts(environmentId: EnvironmentId | null, input: ArtifactListInput) {
  const queryAtom =
    environmentId === null ? null : serverEnvironment.artifacts({ environmentId, input });
  const query = useEnvironmentQuery<ArtifactListResult, unknown>(queryAtom);

  return {
    artifacts: query.data?.artifacts ?? [],
    indexedAt: query.data?.indexedAt ?? null,
    error: query.error,
    isPending: query.isPending,
    refresh: query.refresh,
  };
}
