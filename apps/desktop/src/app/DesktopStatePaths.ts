import * as Option from "effect/Option";

export type JoinPath = (first: string, ...segments: string[]) => string;

function normalizeConfiguredBaseDir(kairoHome: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(kairoHome)) {
    return Option.none();
  }
  const trimmed = kairoHome.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly kairoHome: Option.Option<string>;
}): string {
  return Option.getOrElse(normalizeConfiguredBaseDir(input.kairoHome), () =>
    input.joinPath(input.homeDirectory, ".kairo"),
  );
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly kairoHome: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.kairoHome));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}
