import {
  KAIRO_PROJECT_FILE_NAME,
  type EnvironmentId,
  type ProjectReadFileResult,
  type KairoProjectFile,
} from "@kairo/contracts";
import { parseKairoProjectFile } from "@kairo/shared/kairoProjectFile";
import { executeAtomQuery } from "@kairo/client-runtime/state/runtime";
import { AsyncResult } from "effect/reactivity";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { appAtomRegistry } from "~/rpc/atomRegistry";

function toKairoProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
  result: ProjectReadFileResult | null,
): KairoProjectFile | null {
  const data = resolveProjectFileQueryData(
    environmentId,
    workspaceRoot,
    KAIRO_PROJECT_FILE_NAME,
    result,
  );
  if (data === null || data.exists === false || data.truncated) return null;
  return parseKairoProjectFile(data.contents);
}

export async function readKairoProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
  signal?: AbortSignal,
): Promise<KairoProjectFile | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    getProjectFileQueryAtom(environmentId, workspaceRoot, KAIRO_PROJECT_FILE_NAME),
    { reportDefect: false, reportFailure: false, signal },
  );
  return toKairoProjectFile(
    environmentId,
    workspaceRoot,
    result._tag === "Success" ? result.value : null,
  );
}

/** The project's kairo.json from an earlier read, or `undefined` when none has loaded yet. */
export function peekKairoProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): KairoProjectFile | null | undefined {
  const result = appAtomRegistry.get(
    getProjectFileQueryAtom(environmentId, workspaceRoot, KAIRO_PROJECT_FILE_NAME),
  );
  return AsyncResult.isSuccess(result)
    ? toKairoProjectFile(environmentId, workspaceRoot, result.value)
    : undefined;
}
