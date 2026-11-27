import { msg } from "gt-react";
import type { ArtifactKind } from "@kairo/contracts";

export type ArtifactFilter = "all" | ArtifactKind;

export const ARTIFACT_FILTERS: ReadonlyArray<{ value: ArtifactFilter; label: string }> = [
  { value: "all", label: msg("All") },
  { value: "document", label: msg("Documents") },
  { value: "presentation", label: msg("Presentations") },
  { value: "spreadsheet", label: msg("Spreadsheets") },
  { value: "csv", label: msg("CSV") },
  { value: "pdf", label: msg("PDFs") },
];

export const ARTIFACT_FORMAT_LABELS: Record<ArtifactKind, string> = {
  document: msg("Word document"),
  presentation: msg("PowerPoint presentation"),
  spreadsheet: msg("Excel workbook"),
  csv: msg("CSV file"),
  pdf: msg("PDF"),
};
