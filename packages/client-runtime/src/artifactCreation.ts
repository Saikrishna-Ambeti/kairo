import { msg } from "gt-i18n";

export const ARTIFACT_CREATION_COMMANDS = [
  {
    kind: "document",
    label: msg("Document"),
    creationTitle: msg("Create document"),
    extension: ".docx",
  },
  {
    kind: "presentation",
    label: msg("Presentation"),
    creationTitle: msg("Create presentation"),
    extension: ".pptx",
  },
  {
    kind: "spreadsheet",
    label: msg("Spreadsheet"),
    creationTitle: msg("Create spreadsheet"),
    extension: ".xlsx",
  },
  { kind: "csv", label: msg("CSV"), creationTitle: msg("Create CSV file"), extension: ".csv" },
  { kind: "pdf", label: msg("PDF"), creationTitle: msg("Create PDF"), extension: ".pdf" },
] as const;

export type ArtifactCreationKind = (typeof ARTIFACT_CREATION_COMMANDS)[number]["kind"];

export function isArtifactCreationKind(value: string): value is ArtifactCreationKind {
  return ARTIFACT_CREATION_COMMANDS.some(({ kind }) => kind === value);
}

const ARTIFACT_REQUESTS: Record<ArtifactCreationKind, string> = {
  document: "Create an editable Word document (.docx)",
  presentation: "Create an editable PowerPoint presentation (.pptx)",
  spreadsheet: "Create an editable Excel workbook (.xlsx)",
  csv: "Create a CSV file (.csv)",
  pdf: "Create a PDF file (.pdf)",
};

export function artifactCreationPrompt(kind: ArtifactCreationKind): string {
  // oxlint-disable-next-line kairo/no-untranslated-copy -- The agent prompt uses English independently of the client locale.
  return `${ARTIFACT_REQUESTS[kind]} for the task below. Use the attached files as source material. Save the finished file under artifacts/ in this thread's workspace. Check its content and layout, then return a relative Markdown link to the file and state what you checked. Preserve any existing file content unless the task asks you to change it.\n\n`;
}

export function prependArtifactCreationPrompt(kind: ArtifactCreationKind, draft: string): string {
  const existingKind = ARTIFACT_CREATION_COMMANDS.find((item) =>
    draft.startsWith(artifactCreationPrompt(item.kind).trimEnd()),
  )?.kind;
  const body = existingKind
    ? draft.slice(artifactCreationPrompt(existingKind).trimEnd().length).trimStart()
    : draft.trimStart();
  return `${artifactCreationPrompt(kind)}${body}`;
}

export function prependArtifactRevisionPrompt(relativePath: string, draft: string): string {
  const instruction = `Revise the existing file at ${JSON.stringify(relativePath)}. Change only the part I describe below; preserve unrelated content, formatting, formulas, and slide order. Check the changed file and return a relative Markdown link to it.`;
  if (draft.startsWith(instruction)) return draft;
  const changeMarker = "\nChange: ";
  const previousChangeIndex = draft.startsWith("Revise the existing file at ")
    ? draft.indexOf(changeMarker)
    : -1;
  const body =
    previousChangeIndex === -1
      ? draft.trimStart()
      : draft.slice(previousChangeIndex + changeMarker.length);
  // oxlint-disable-next-line kairo/no-untranslated-copy -- These are field markers in the agent prompt.
  return `${instruction}\n\nLocation (page, slide, passage, sheet, or cells): \nChange: ${body}`;
}
