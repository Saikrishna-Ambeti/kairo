export const ARTIFACT_CREATION_COMMANDS = [
  { kind: "document", label: "Document", extension: ".docx" },
  { kind: "presentation", label: "Presentation", extension: ".pptx" },
  { kind: "spreadsheet", label: "Spreadsheet", extension: ".xlsx" },
  { kind: "csv", label: "CSV", extension: ".csv" },
  { kind: "pdf", label: "PDF", extension: ".pdf" },
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
  return `${instruction}\n\nLocation (page, slide, passage, sheet, or cells): \nChange: ${body}`;
}
