import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import { ThreadEnvMode, WorktreeSubmodules } from "./environment.ts";
import { ProjectScriptIcon } from "./orchestration.ts";
import type { ProjectScopedServerSettingKey, ServerSettings } from "./settings.ts";

/** File name of the checked-in Kairo project file, resolved at the workspace root. */
export const KAIRO_PROJECT_FILE_NAME = "kairo.json";

/** Public URL of the published JSON Schema for {@link KairoProjectFile}. */
export const KAIRO_PROJECT_FILE_SCHEMA_URL = "https://kairo.codes/schema/kairo.json";

const KAIRO_PROJECT_FILE_PATH_MAX_LENGTH = 512;
const KAIRO_PROJECT_FILE_MAX_SCRIPTS = 50;

// Annotations go on the encoded (string) side so they survive into the
// published JSON Schema; decoding still trims and re-validates non-emptiness.
const trimmedNonEmpty = (annotations: { readonly description: string }, maxLength?: number) => {
  const annotated = Schema.String.annotate(annotations);
  const encoded =
    maxLength === undefined
      ? annotated.check(Schema.isNonEmpty())
      : annotated.check(Schema.isNonEmpty(), Schema.isMaxLength(maxLength));
  return encoded.pipe(Schema.decodeTo(encoded, SchemaTransformation.trim()));
};

export const KairoProjectFileScript = Schema.Struct({
  name: trimmedNonEmpty({
    description: "Display name for the script, shown in the Kairo scripts menu.",
  }),
  command: trimmedNonEmpty({
    description: "Shell command executed in a Kairo terminal at the project root.",
  }),
  icon: Schema.optionalKey(
    ProjectScriptIcon.annotate({
      description: 'Icon shown next to the script in the scripts menu. Defaults to "play".',
    }),
  ),
  runOnWorktreeCreate: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, the script runs automatically after a worktree is created for a new thread.",
    }),
  ),
  async: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Only for runOnWorktreeCreate scripts. When true (the default), the agent starts while the script is still running. Set false to hold the agent until the script exits.",
    }),
  ),
  previewUrl: Schema.optionalKey(
    trimmedNonEmpty({
      description:
        "URL opened in the in-app browser preview when this script runs. Only honored on the desktop build.",
    }),
  ),
  autoOpenPreview: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, automatically open the preview panel at `previewUrl` the moment the script starts.",
    }),
  ),
}).annotate({
  description: "A project script that team members can import into Kairo.",
});
export type KairoProjectFileScript = typeof KairoProjectFileScript.Type;

export const KairoProjectFile = Schema.Struct({
  $schema: Schema.optionalKey(
    Schema.String.annotate({
      description: `URL of the JSON Schema for this file, typically "${KAIRO_PROJECT_FILE_SCHEMA_URL}".`,
    }),
  ),
  iconPath: Schema.optionalKey(
    trimmedNonEmpty(
      {
        description:
          'Workspace-relative path to the project icon (e.g. "assets/logo.svg"). Checked before Kairo\'s built-in icon locations.',
      },
      KAIRO_PROJECT_FILE_PATH_MAX_LENGTH,
    ),
  ),
  defaultThreadEnvMode: Schema.optionalKey(
    ThreadEnvMode.annotate({
      description:
        'Where new threads start for this repository: "worktree" for a fresh git worktree, "local" for the current checkout. A per-project setting in Kairo overrides this; when neither is set, the global default applies.',
    }),
  ),
  worktreeSubmodules: Schema.optionalKey(
    WorktreeSubmodules.annotate({
      description:
        'How new worktrees populate git submodules: "recursive" (the default) initializes nested submodules too, "top-level" initializes only those declared by this repository, and "none" leaves every submodule empty for a setup script to handle. A project or environment setting in Kairo overrides this.',
    }),
  ),
  scripts: Schema.optionalKey(
    Schema.Array(KairoProjectFileScript)
      .annotate({
        description: "Project scripts shared with everyone who opens this repository in Kairo.",
      })
      .check(Schema.isMaxLength(KAIRO_PROJECT_FILE_MAX_SCRIPTS)),
  ),
}).annotate({
  title: "Kairo project file",
  description:
    "Checked-in project configuration for Kairo (kairo.json at the repository root). See https://kairo.codes for documentation.",
});
export type KairoProjectFile = typeof KairoProjectFile.Type;

/**
 * Settings a repository can also declare in kairo.json. A key here must be
 * nullable on `ServerSettings` (null means inherit) so both the project
 * override and the environment value can defer to the file; `field` names
 * the kairo.json field carrying the same value and `builtIn` is what applies
 * when every tier is unset. `resolveProjectSettings` walks project override,
 * environment value, file, built-in, so listing a key here is the whole
 * change for a new file-backed setting.
 */
export const PROJECT_FILE_BACKED_SETTINGS = {
  defaultThreadEnvMode: { field: "defaultThreadEnvMode", builtIn: "local" },
  worktreeSubmodules: { field: "worktreeSubmodules", builtIn: "recursive" },
} as const satisfies {
  readonly [K in ProjectScopedServerSettingKey]?: {
    readonly field: {
      readonly [F in keyof KairoProjectFile]: KairoProjectFile[F] extends
        | Exclude<ServerSettings[K], null>
        | undefined
        ? F
        : never;
    }[keyof KairoProjectFile];
    readonly builtIn: Exclude<ServerSettings[K], null>;
  };
};
export type ProjectFileBackedSettingKey = keyof typeof PROJECT_FILE_BACKED_SETTINGS;

/**
 * `ServerSettings` with every file-backed key resolved to a concrete value.
 * What `resolveProjectSettings(...).settings` produces once a kairo.json (or
 * its absence) has been accounted for.
 */
export type ResolvedServerSettings = Omit<ServerSettings, ProjectFileBackedSettingKey> & {
  readonly [K in ProjectFileBackedSettingKey]: Exclude<ServerSettings[K], null>;
};
