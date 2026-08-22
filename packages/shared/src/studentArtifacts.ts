export const STUDENT_ARTIFACT_FORMATS = ["document", "pdf", "both"] as const;
export type StudentArtifactFormat = (typeof STUDENT_ARTIFACT_FORMATS)[number];

export const STUDENT_ARTIFACT_TEMPLATES = ["assignment", "study-guide", "notes"] as const;
export type StudentArtifactTemplate = (typeof STUDENT_ARTIFACT_TEMPLATES)[number];

export const STUDENT_ARTIFACT_TEMPLATE_LABELS: Record<StudentArtifactTemplate, string> = {
  assignment: "Assignment or report",
  "study-guide": "Study guide",
  notes: "Class notes",
};

export const STUDENT_ARTIFACT_FORMAT_LABELS: Record<StudentArtifactFormat, string> = {
  document: "Word document",
  pdf: "PDF",
  both: "Word document and PDF",
};

export interface StudentArtifactRequest {
  readonly title: string;
  readonly instructions: string;
  readonly template: StudentArtifactTemplate;
  readonly format: StudentArtifactFormat;
}

const FALLBACK_ARTIFACT_BASENAME = "student-document";

export function studentArtifactBasename(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return normalized || FALLBACK_ARTIFACT_BASENAME;
}

function deliverables(format: StudentArtifactFormat, basename: string): string[] {
  const outputs: string[] = [];
  if (format === "document" || format === "both") {
    outputs.push(`- Editable Word document at \`artifacts/${basename}.docx\`.`);
  }
  if (format === "pdf" || format === "both") {
    outputs.push(`- PDF at \`artifacts/${basename}.pdf\`.`);
  }
  return outputs;
}

function finalLinks(format: StudentArtifactFormat, basename: string): string[] {
  const links: string[] = [];
  if (format === "document" || format === "both") {
    links.push(`[Download Word document](artifacts/${basename}.docx)`);
  }
  if (format === "pdf" || format === "both") {
    links.push(`[Open PDF](artifacts/${basename}.pdf)`);
  }
  return links;
}

export function buildStudentArtifactPrompt(request: StudentArtifactRequest): string {
  const title = request.title.trim() || "Untitled student document";
  const instructions = request.instructions.trim() || "Organize the supplied topic clearly.";
  const basename = studentArtifactBasename(title);
  const template = STUDENT_ARTIFACT_TEMPLATE_LABELS[request.template];

  return [
    `Create a polished ${template.toLowerCase()} titled "${title}".`,
    "",
    "Content requirements:",
    instructions,
    "",
    "Deliverables:",
    ...deliverables(request.format, basename),
    "- Keep an editable Markdown source beside the exports.",
    "- Use available document and PDF tools. Do not substitute plain text files with renamed extensions.",
    "- Render and inspect each export before finishing. Fix clipping, overflow, broken characters, and weak page breaks.",
    "",
    "Finish with these exact workspace-relative links on separate lines:",
    ...finalLinks(request.format, basename),
  ].join("\n");
}

export function buildStudentArtifactStarterPrompt(): string {
  return buildStudentArtifactPrompt({
    title: "Document title",
    instructions:
      "Replace this line with the topic, required sections, sources, and formatting rules.",
    template: "assignment",
    format: "both",
  });
}

export function appendStudentArtifactPrompt(existing: string, artifactPrompt: string): string {
  const current = existing.trim();
  return current.length === 0 ? artifactPrompt : `${current}\n\n${artifactPrompt}`;
}
