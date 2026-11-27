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

export class KairoProjectFileLoadError extends Schema.TaggedError<KairoProjectFileLoadError>()(
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

export class KairoProjectFileLoader extends Context.Service<
  KairoProjectFileLoader,
  {
    /** Never fails; missing/unreadable/invalid files return none, with warnings for invalid files. */
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

/** @public */
export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load: KairoProjectFileLoader["Service"]["load"] = Effect.fn("KairoProjectFileLoader.load")(
    function* (workspaceRoot) {
      const filePath = path.join(workspaceRoot, KAIRO_PROJECT_FILE_NAME);
      const raw = yield* fileSystem.readFileString(filePath).pipe(
        Effect.asSome,
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
        Effect.asSome,
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
