import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { KairoProjectFile, KAIRO_PROJECT_FILE_SCHEMA_URL } from "@kairo/contracts";

import { fromLenientJson } from "./schemaJson.ts";

export const KairoProjectFileFromJson = fromLenientJson(KairoProjectFile);

const decodeKairoProjectFile = Schema.decodeExit(KairoProjectFileFromJson);

export function parseKairoProjectFile(contents: string): KairoProjectFile | null {
  const decoded = decodeKairoProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

export function buildKairoProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(KairoProjectFile, { onExcessProperty: "error" });
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
