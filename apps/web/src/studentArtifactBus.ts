const STUDENT_ARTIFACT_OPEN_EVENT = "kairo:open-student-artifact-generator";

export function openStudentArtifactGenerator(): void {
  window.dispatchEvent(new CustomEvent(STUDENT_ARTIFACT_OPEN_EVENT));
}

export function onOpenStudentArtifactGenerator(listener: () => void): () => void {
  window.addEventListener(STUDENT_ARTIFACT_OPEN_EVENT, listener);
  return () => window.removeEventListener(STUDENT_ARTIFACT_OPEN_EVENT, listener);
}
