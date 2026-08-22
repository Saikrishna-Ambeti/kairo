/**
 * KairoProjectFileLoader - Effect service that loads the checked-in `kairo.json`
 * project file from a workspace root.
 *
 * Loading is best-effort: a missing file resolves to `Option.none`, and
 * unreadable or invalid files are logged and treated as absent so callers
 * can fall back to their defaults.
 *
 * @module KairoProjectFileLoader
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { KAIRO_PROJECT_FILE_NAME, type KairoProjectFile } from "@kairo/contracts";
import { KairoProjectFileFromJson } from "@kairo/shared/kairoProjectFile";

const decodeKairoProjectFileJson = Schema.decodeEffect(KairoProjectFileFromJson);

export class KairoProjectFileLoadError extends Schema.TaggedErrorClass<KairoProjectFileLoadError>()(
  "KairoProjectFileLoadError",
  {
    operation: Schema.Literals(["read", "decode"]),
    workspaceRoot: Schema.String,
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} ${KAIRO_PROJECT_FILE_NAME} at ${this.filePath}.`;
  }
}

/** Service tag for kairo.json project file loading. */
export class KairoProjectFileLoader extends Context.Service<
  KairoProjectFileLoader,
  {
    /**
     * Load and decode `kairo.json` at the workspace root.
     *
     * Never fails: missing, unreadable, or invalid files resolve to
     * `Option.none` (invalid files are logged as warnings).
     */
    readonly load: (workspaceRoot: string) => Effect.Effect<Option.Option<KairoProjectFile>>;
  }
>()("kairo/project/KairoProjectFileLoader") {}

const logKairoProjectFileLoadError = (error: KairoProjectFileLoadError) =>
  Effect.logWarning(error).pipe(
    Effect.annotateLogs({
      operation: error.operation,
      workspaceRoot: error.workspaceRoot,
      filePath: error.filePath,
      errorTag: error._tag,
    }),
  );

export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load: KairoProjectFileLoader["Service"]["load"] = Effect.fn("KairoProjectFileLoader.load")(
    function* (workspaceRoot) {
      const filePath = path.join(workspaceRoot, KAIRO_PROJECT_FILE_NAME);
      const raw = yield* fileSystem.readFileString(filePath).pipe(
        Effect.map(Option.some),
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound"
              ? Effect.succeed(Option.none<string>())
              : logKairoProjectFileLoadError(
                  new KairoProjectFileLoadError({
                    operation: "read",
                    workspaceRoot,
                    filePath,
                    cause: error,
                  }),
                ).pipe(Effect.as(Option.none<string>())),
        }),
      );
      if (Option.isNone(raw)) {
        return Option.none<KairoProjectFile>();
      }
      return yield* decodeKairoProjectFileJson(raw.value).pipe(
        Effect.map(Option.some),
        Effect.catchTags({
          SchemaError: (error) =>
            logKairoProjectFileLoadError(
              new KairoProjectFileLoadError({
                operation: "decode",
                workspaceRoot,
                filePath,
                cause: error,
              }),
            ).pipe(Effect.as(Option.none<KairoProjectFile>())),
        }),
      );
    },
  );

  return KairoProjectFileLoader.of({ load });
});

export const layer = Layer.effect(KairoProjectFileLoader, make);
