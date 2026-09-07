import type Database from "better-sqlite3";
import { assertMemberCanUseProject, projectAudience, resolveMemberProject } from "./project-scope";
import { findMemberById } from "./repository";

type Sqlite = Database.Database;

export function requireProjectId(searchParams: URLSearchParams): number {
  const raw = searchParams.get("projectId");
  if (!raw) throw new Error("projectId is required");
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("projectId must be a positive integer");
  return projectId;
}

export function buildMemberBootstrap(db: Sqlite, memberId: number, requestedProjectId?: number) {
  const sessionMember = findMemberById(db, memberId);
  if (!sessionMember) throw new Error("Member access is required");
  return { ...resolveMemberProject(db, memberId, requestedProjectId), sessionMember, admin: false, hasMembers: true };
}

export function assertWritableProject(db: Sqlite, memberId: number, projectId: number | null): void {
  if (projectId != null) assertMemberCanUseProject(db, memberId, projectId);
}

export function assertRequestedMembersInProject(db: Sqlite, projectId: number, memberIds: number[]): number[] {
  const audienceIds = new Set(projectAudience(db, projectId).members.map((member) => member.id));
  if (memberIds.some((memberId) => !audienceIds.has(memberId))) throw new Error("Selected people must belong to this project");
  return memberIds;
}

export function isProjectAccessError(error: unknown): boolean {
  return error instanceof Error && (
    error.message === "Project access is not available"
    || error.message === "Ask an administrator to assign you to an active project"
  );
}
