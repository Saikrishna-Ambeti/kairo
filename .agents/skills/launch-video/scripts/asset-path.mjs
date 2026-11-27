import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

function isInside(root, candidate) {
  const relative = NodePath.relative(root, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${NodePath.sep}`) &&
    !NodePath.isAbsolute(relative)
  );
}

export async function resolveAssetPath(root, encodedPath) {
  try {
    const canonicalRoot = await NodeFSP.realpath(root);
    const candidate = NodePath.join(canonicalRoot, decodeURIComponent(encodedPath));
    if (!isInside(canonicalRoot, candidate)) return null;

    const file = await NodeFSP.realpath(candidate);
    if (!isInside(canonicalRoot, file)) return null;
    return (await NodeFSP.stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}
