import type { ArtifactListInput, ArtifactListResult, EnvironmentId } from "@kairo/contracts";
import { useMemo } from "react";

import { serverEnvironment } from "./server";
import { useEnvironmentQuery } from "./query";

export function useArtifacts(environmentId: EnvironmentId | null, input: ArtifactListInput) {
  const inputKey = JSON.stringify(input);
  const queryAtom = useMemo(
    () =>
      environmentId === null
        ? null
        : serverEnvironment.artifacts({
            environmentId,
            input: JSON.parse(inputKey) as ArtifactListInput,
          }),
    [environmentId, inputKey],
  );
  const query = useEnvironmentQuery<ArtifactListResult, unknown>(queryAtom);

  return {
    artifacts: query.data?.artifacts ?? [],
    indexedAt: query.data?.indexedAt ?? null,
    error: query.error,
    isPending: query.isPending,
    refresh: query.refresh,
  };
}
