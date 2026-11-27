import { EnvironmentId, ProjectId, ThreadId } from "@kairo/contracts";

export function scopedProjectKey(environmentId: EnvironmentId, projectId: ProjectId): string {
  return `${environmentId}:${projectId}`;
}

export function scopedThreadKey(environmentId: EnvironmentId, threadId: ThreadId): string {
  return `${environmentId}:${threadId}`;
}
