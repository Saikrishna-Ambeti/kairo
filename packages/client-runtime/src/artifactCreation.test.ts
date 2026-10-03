import { describe, expect, it } from "vite-plus/test";

import {
  artifactCreationPrompt,
  prependArtifactCreationPrompt,
  prependArtifactRevisionPrompt,
} from "./artifactCreation.js";

describe("artifact creation prompts", () => {
  it("keeps a draft once when the same format is selected again", () => {
    const first = prependArtifactCreationPrompt("presentation", "Quarterly results");
    expect(prependArtifactCreationPrompt("presentation", first)).toBe(first);
  });

  it("replaces the previous format brief while keeping the request", () => {
    const first = prependArtifactCreationPrompt("document", "Quarterly results");
    expect(prependArtifactCreationPrompt("spreadsheet", first)).toBe(
      `${artifactCreationPrompt("spreadsheet")}Quarterly results`,
    );
  });

  it("replaces a brief after the editor moves its blank lines to the end", () => {
    const collapsed = `${artifactCreationPrompt("presentation").trimEnd()}Quarterly roadmap\n\n`;
    expect(prependArtifactCreationPrompt("document", collapsed)).toBe(
      `${artifactCreationPrompt("document")}Quarterly roadmap\n\n`,
    );
  });

  it("quotes the revision path so spaces and punctuation stay unambiguous", () => {
    expect(
      prependArtifactRevisionPrompt("artifacts/Q3 report (final).pptx", "Fix slide 4"),
    ).toContain('at "artifacts/Q3 report (final).pptx".');
  });

  it("keeps one revision brief when the same file is selected twice", () => {
    const first = prependArtifactRevisionPrompt("artifacts/report.docx", "Fix the title");
    expect(prependArtifactRevisionPrompt("artifacts/report.docx", first)).toBe(first);
  });

  it("moves an existing revision request to a newly selected file", () => {
    const first = prependArtifactRevisionPrompt("artifacts/report.docx", "Fix the title");
    const next = prependArtifactRevisionPrompt("artifacts/slides.pptx", first);
    expect(next).toContain('at "artifacts/slides.pptx".');
    expect(next).toContain("Change: Fix the title");
    expect(next).not.toContain("artifacts/report.docx");
  });
});
