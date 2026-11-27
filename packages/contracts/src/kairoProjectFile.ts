import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import { ThreadEnvMode, WorktreeSubmodules } from "./environment.ts";
import { ProjectScriptIcon } from "./project.ts";
import type { ProjectScopedServerSettingKey, ServerSettings } from "./settings.ts";

export const KAIRO_PROJECT_FILE_NAME = "kairo.json";

export const KAIRO_PROJECT_FILE_SCHEMA_URL = "https://kairo.codes/schema/kairo.json";

const KAIRO_PROJECT_FILE_PATH_MAX_LENGTH = 512;
const KAIRO_PROJECT_FILE_COMMAND_MAX_LENGTH = 4096;
const KAIRO_PROJECT_FILE_MAX_SCRIPTS = 50;

// Encoded-side annotations survive into JSON Schema; decoding still trims and rejects empty strings.
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
  runOnSettle: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, the script runs in the thread's worktree each time the thread settles, for example to delete build output. Threads without their own worktree skip it.",
    }),
  ),
  stopOnSettle: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "When true, Kairo stops this action's terminal and child processes when its thread settles.",
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
  ignoreRepositories: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Repositories inside the project folder that Kairo should leave out of the project, as paths relative to it, such as vendor/big. They are then neither reviewed on their own nor given worktrees.",
    }),
  ),
  worktreeLayout: Schema.optionalKey(
    Schema.Struct({
      create: trimmedNonEmpty(
        {
          description:
            "Shell command that lays out a thread's folder for a project tracking several repositories, in place of Kairo's own worktrees and links. It runs in the project folder with KAIRO_WORKTREE_ROOT (the folder to fill), KAIRO_WORKTREE_PROJECT_PATH (where the project folder goes inside it), KAIRO_WORKTREE_BRANCH, KAIRO_WORKTREE_BASE, KAIRO_WORKTREE_REPOSITORIES (the chosen repositories, one path per line) and KAIRO_PROJECT_ROOT set. Each of the project's repositories it checks out at the same relative place is adopted as the thread's checkout of it, and must be a git worktree of that repository on KAIRO_WORKTREE_BRANCH. It runs again when the folder goes missing, so it must cope with the branch already existing. It has ten minutes.",
        },
        KAIRO_PROJECT_FILE_COMMAND_MAX_LENGTH,
      ),
      remove: Schema.optionalKey(
        trimmedNonEmpty(
          {
            description:
              "Shell command that takes the thread's folder down again, with the same variables. It can run on a folder that is partly gone, and should delete what create generated. Kairo removes the checkouts it leaves behind.",
          },
          KAIRO_PROJECT_FILE_COMMAND_MAX_LENGTH,
        ),
      ),
    }).annotate({
      description:
        "Lets the project create and remove a worktree thread's folder itself, for layouts with shared build output or workspace metadata.",
    }),
  ),
  worktreeSparsePatternsPath: Schema.optionalKey(
    trimmedNonEmpty(
      {
        description:
          'Repository-relative path to a git sparse-checkout pattern file in non-cone syntax (e.g. ".kairo/sparse-checkout"). New worktrees check out only the files it matches. Both files are read from the branch being checked out; a missing pattern file fails the worktree instead of checking out everything.',
      },
      KAIRO_PROJECT_FILE_PATH_MAX_LENGTH,
    ),
  ),
  scripts: Schema.optionalKey(
    Schema.Array(KairoProjectFileScript)
      .annotate({
        description: "Project scripts shared with everyone who opens this repository in Kairo.",
      })
      .check(Schema.isMaxLength(KAIRO_PROJECT_FILE_MAX_SCRIPTS)),
  ),
}).annotate({
  title: "T3 project file",
  description:
    "Checked-in project configuration for Kairo (kairo.json at the repository root). See https://kairo.codes for documentation.",
});
export type KairoProjectFile = typeof KairoProjectFile.Type;

/** Keys must be nullable in ServerSettings so both environment and project overrides can inherit kairo.json. */
export const PROJECT_FILE_BACKED_SETTINGS = {
  defaultThreadEnvMode: { field: "defaultThreadEnvMode", builtIn: "local" },
  worktreeSubmodules: { field: "worktreeSubmodules", builtIn: "recursive" },
} as const satisfies {
  // providerInstances overrides individual fields, so it cannot use whole-setting file inheritance.
  readonly [K in ProjectScopedServerSettingKey & keyof ServerSettings]?: {
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

export type ResolvedServerSettings = Omit<ServerSettings, ProjectFileBackedSettingKey> & {
  readonly [K in ProjectFileBackedSettingKey]: Exclude<ServerSettings[K], null>;
};
