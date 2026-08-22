import { describe, expect, it } from "vite-plus/test";

import {
  appendStudentArtifactPrompt,
  buildStudentArtifactPrompt,
  buildStudentArtifactStarterPrompt,
  studentArtifactBasename,
} from "./studentArtifacts.ts";

describe("student artifacts", () => {
  it("builds stable safe filenames from document titles", () => {
    expect(studentArtifactBasename("  Thermodynamics: Week 1  ")).toBe("thermodynamics-week-1");
    expect(studentArtifactBasename("!!!")).toBe("student-document");
  });

  it("requests real Word and PDF files with links the chat can render", () => {
    const prompt = buildStudentArtifactPrompt({
      title: "Cell Biology Review",
      instructions: "Cover mitosis and meiosis with a comparison table.",
      template: "study-guide",
      format: "both",
    });

    expect(prompt).toContain("artifacts/cell-biology-review.docx");
    expect(prompt).toContain("artifacts/cell-biology-review.pdf");
    expect(prompt).toContain("Do not substitute plain text files with renamed extensions.");
    expect(prompt).toContain("[Open PDF](artifacts/cell-biology-review.pdf)");
  });

  it("preserves an existing draft when adding an artifact request", () => {
    expect(appendStudentArtifactPrompt("Keep these citations.", "Create the file.")).toBe(
      "Keep these citations.\n\nCreate the file.",
    );
  });

  it("provides an editable starter request for compact clients", () => {
    expect(buildStudentArtifactStarterPrompt()).toContain(
      "Replace this line with the topic, required sections, sources, and formatting rules.",
    );
  });
});
