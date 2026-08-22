import {
  KAIRO_PROJECT_FILE_NAME,
  type EnvironmentId,
  type KairoProjectFile,
  type KairoProjectFileScript,
} from "@kairo/contracts";
import { parseKairoProjectFile } from "@kairo/shared/kairoProjectFile";
import { useMemo } from "react";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<KairoProjectFileScript> = [];

export interface KairoProjectFileState {
  /**
   * - `valid`: kairo.json exists and decoded.
   * - `invalid`: kairo.json exists but fails to decode (the server then ignores
   *   the whole file, including `iconPath` and every script).
   * - `missing`: no readable kairo.json at the workspace root.
   * - `loading`: the file query has not settled yet.
   */
  status: "loading" | "missing" | "invalid" | "valid";
  /** The decoded file when status is `valid`, null otherwise. */
  file: KairoProjectFile | null;
  scripts: ReadonlyArray<KairoProjectFileScript>;
}

/**
 * Decoded state of the project's checked-in `kairo.json`, including whether the
 * file exists but is broken — which the runtime otherwise swallows silently.
 */
export function useKairoProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): KairoProjectFileState {
  const query = useProjectFileQuery(
    environmentId,
    cwd ?? "",
    KAIRO_PROJECT_FILE_NAME,
    cwd !== null,
  );
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  return useMemo(() => {
    if (contents === null) {
      return {
        status: isPending ? "loading" : "missing",
        file: null,
        scripts: NO_SCRIPTS,
      } as const;
    }
    const file = parseKairoProjectFile(contents);
    if (file === null) {
      return { status: "invalid", file: null, scripts: NO_SCRIPTS } as const;
    }
    return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS } as const;
  }, [contents, isPending]);
}

/**
 * Scripts declared in the project's checked-in `kairo.json`, offered in the
 * scripts menu for import. Missing, truncated, or invalid files resolve to
 * an empty list.
 */
export function useKairoProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<KairoProjectFileScript> {
  return useKairoProjectFileState(environmentId, cwd).scripts;
}
