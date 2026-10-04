import type { ArtifactKind } from "@kairo/contracts";

export type ArtifactFilter = "all" | ArtifactKind;

export const ARTIFACT_FILTERS: ReadonlyArray<{ value: ArtifactFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "document", label: "Documents" },
  { value: "presentation", label: "Presentations" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDFs" },
];

export const ARTIFACT_FORMAT_LABELS: Record<ArtifactKind, string> = {
  document: "Word document",
  presentation: "PowerPoint presentation",
  spreadsheet: "Excel workbook",
  csv: "CSV file",
  pdf: "PDF",
};
