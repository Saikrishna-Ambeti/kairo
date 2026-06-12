import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const ProductSurfaceProfile = Schema.Literals(["developer", "nonTechnicalAi"]);
export type ProductSurfaceProfile = typeof ProductSurfaceProfile.Type;

export const ProductSurfaceConfig = Schema.Struct({
  sourceControl: Schema.Literals(["enabled", "hidden"]),
  sourceControlProviders: Schema.Literals(["enabled", "hidden"]),
  diffViewer: Schema.Literals(["enabled", "hidden"]),
  checkpointRollback: Schema.Literals(["enabled", "hidden"]),
  terminal: Schema.Literals(["enabled", "disabled"]),
  developerKeybindings: Schema.Literals(["enabled", "hidden"]),
});
export type ProductSurfaceConfig = typeof ProductSurfaceConfig.Type;

export const ProductSurfaceKey = Schema.Literals([
  "sourceControl",
  "sourceControlProviders",
  "diffViewer",
  "checkpointRollback",
  "terminal",
  "developerKeybindings",
]);
export type ProductSurfaceKey = typeof ProductSurfaceKey.Type;

export const DEVELOPER_PRODUCT_SURFACES = {
  sourceControl: "enabled",
  sourceControlProviders: "enabled",
  diffViewer: "enabled",
  checkpointRollback: "enabled",
  terminal: "enabled",
  developerKeybindings: "enabled",
} as const satisfies ProductSurfaceConfig;

export const NON_TECHNICAL_AI_SURFACES = {
  sourceControl: "hidden",
  sourceControlProviders: "hidden",
  diffViewer: "hidden",
  checkpointRollback: "hidden",
  terminal: "disabled",
  developerKeybindings: "hidden",
} as const satisfies ProductSurfaceConfig;

export const DEFAULT_PRODUCT_SURFACE_PROFILE =
  "nonTechnicalAi" as const satisfies ProductSurfaceProfile;
export const DEFAULT_PRODUCT_SURFACE_CONFIG = NON_TECHNICAL_AI_SURFACES;

export const ProductSurfaceConfigWithDefault = ProductSurfaceConfig.pipe(
  Schema.withDecodingDefault(Effect.succeed(DEFAULT_PRODUCT_SURFACE_CONFIG)),
);

export class SurfaceUnavailableError extends Schema.TaggedErrorClass<SurfaceUnavailableError>()(
  "SurfaceUnavailableError",
  {
    code: Schema.Literal("SURFACE_DISABLED"),
    surface: ProductSurfaceKey,
    message: Schema.String,
  },
) {}
