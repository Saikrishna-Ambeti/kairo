import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { KairoProjectFile, KAIRO_PROJECT_FILE_SCHEMA_URL } from "@kairo/contracts";

import { fromLenientJson } from "./schemaJson.ts";

/**
 * Codec between the raw `kairo.json` file contents (lenient JSONC string) and the
 * decoded {@link KairoProjectFile}.
 */
export const KairoProjectFileFromJson = fromLenientJson(KairoProjectFile);

const decodeKairoProjectFile = Schema.decodeExit(KairoProjectFileFromJson);

/**
 * Decode raw `kairo.json` contents, treating invalid or malformed files as
 * absent. Clients use this to read optional defaults (scripts, thread env
 * mode) without surfacing decode errors to the user.
 */
export function parseKairoProjectFile(contents: string): KairoProjectFile | null {
  const decoded = decodeKairoProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

/**
 * Build the publishable JSON Schema document for `kairo.json` (draft 2020-12).
 *
 * Served from the marketing site at {@link KAIRO_PROJECT_FILE_SCHEMA_URL} so
 * editors get LSP support via a `$schema` reference.
 */
export function buildKairoProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(KairoProjectFile);
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: KAIRO_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
