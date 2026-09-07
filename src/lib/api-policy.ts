import type { DbQueryable } from "./db";
import { assertMemberCanUseProject, projectAudience, resolveMemberProject } from "./project-scope";
import { findMemberById } from "./repository";

export function requireProjectId(searchParams: URLSearchParams): number {
  const raw = searchParams.get("projectId");
  if (!raw) throw new Error("projectId is required");
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("projectId must be a positive integer");
  return projectId;
}

export async function buildMemberBootstrap(db: DbQueryable, memberId: number, requestedProjectId?: number) {
  const sessionMember = await findMemberById(db, memberId);
  if (!sessionMember) throw new Error("Member access is required");
  return { ...(await resolveMemberProject(db, memberId, requestedProjectId)), sessionMember, admin: false, hasMembers: true };
}

export async function assertWritableProject(db: DbQueryable, memberId: number, projectId: number | null): Promise<void> {
  if (projectId != null) await assertMemberCanUseProject(db, memberId, projectId);
}

export async function assertRequestedMembersInProject(db: DbQueryable, projectId: number, memberIds: number[]): Promise<number[]> {
  const audienceIds = new Set((await projectAudience(db, projectId)).members.map((member) => member.id));
  if (memberIds.some((memberId) => !audienceIds.has(memberId))) throw new Error("Selected people must belong to this project");
  return memberIds;
}

export function isProjectAccessError(error: unknown): boolean {
  return error instanceof Error && (
    error.message === "Project access is not available"
    || error.message === "Ask an administrator to assign you to an active project"
  );
}
