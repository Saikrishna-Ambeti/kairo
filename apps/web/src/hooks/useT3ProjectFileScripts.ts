import {
  KAIRO_PROJECT_FILE_NAME,
  type EnvironmentId,
  type KairoProjectFile,
  type KairoProjectFileScript,
} from "@kairo/contracts";
import { parseKairoProjectFile } from "@kairo/shared/kairoProjectFile";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<KairoProjectFileScript> = [];

export interface KairoProjectFileState {
  status: "loading" | "missing" | "invalid" | "valid";
  file: KairoProjectFile | null;
  scripts: ReadonlyArray<KairoProjectFileScript>;
  refresh: () => void;
}

export function useKairoProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): KairoProjectFileState {
  const query = useProjectFileQuery(environmentId, cwd ?? "", KAIRO_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  const refresh = query.refresh;
  if (contents === null) {
    return {
      status: isPending ? "loading" : "missing",
      file: null,
      scripts: NO_SCRIPTS,
      refresh,
    } as const;
  }
  const file = parseKairoProjectFile(contents);
  if (file === null) {
    return { status: "invalid", file: null, scripts: NO_SCRIPTS, refresh } as const;
  }
  return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS, refresh } as const;
}
