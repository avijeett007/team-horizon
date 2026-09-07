import type Database from "better-sqlite3";
import type { Member, Project, Venture } from "./domain";
import { findMemberById, listBootstrap, listEntries, type DisplayEntry } from "./repository";

type Sqlite = Database.Database;

export interface ProjectAudience {
  selectedProject: Project;
  projects: Project[];
  ventures: Venture[];
  members: Member[];
}

export interface MemberProjectScope extends ProjectAudience {
  selectableProjects: Project[];
}

export function projectAudience(db: Sqlite, projectId: number): ProjectAudience {
  const data = listBootstrap(db);
  const selectedProject = data.projects.find((project) => project.id === projectId);
  if (!selectedProject) throw new Error("Project access is not available");
  const venture = data.ventures.find((item) => item.id === selectedProject.ventureId);
  if (!venture) throw new Error("Project access is not available");
  return {
    selectedProject,
    projects: [selectedProject],
    ventures: [venture],
    members: data.members
      .filter((member) => member.projectIds.includes(projectId))
      .map((member) => ({ ...member, projectIds: [projectId], ventureIds: [selectedProject.ventureId] })),
  };
}

export function assertMemberCanUseProject(db: Sqlite, memberId: number, projectId: number): Project {
  const member = findMemberById(db, memberId);
  const project = listBootstrap(db).projects.find((item) => item.id === projectId);
  if (!member || !project || !member.projectIds.includes(projectId)) throw new Error("Project access is not available");
  return project;
}

export function resolveMemberProject(db: Sqlite, memberId: number, requestedProjectId?: number): MemberProjectScope {
  const member = findMemberById(db, memberId);
  if (!member) throw new Error("Member access is required");
  const data = listBootstrap(db);
  const selectableProjects = data.projects.filter((project) => member.projectIds.includes(project.id));
  if (!selectableProjects.length) throw new Error("Ask an administrator to assign you to an active project");
  const selectedProject = requestedProjectId == null
    ? selectableProjects[0]
    : selectableProjects.find((project) => project.id === requestedProjectId);
  if (!selectedProject) throw new Error("Project access is not available");
  return { ...projectAudience(db, selectedProject.id), selectableProjects };
}

export function scopedEntries(
  db: Sqlite,
  projectId: number,
  viewerMemberId: number | null,
  fromUtc: string,
  toUtc: string,
  requestedMemberIds: number[] = [],
): DisplayEntry[] {
  const audienceIds = projectAudience(db, projectId).members.map((member) => member.id);
  const memberIds = requestedMemberIds.length
    ? audienceIds.filter((id) => requestedMemberIds.includes(id))
    : audienceIds;
  if (!memberIds.length) return [];
  return listEntries(db, fromUtc, toUtc, memberIds).map((entry) => {
    const crossProject = entry.projectId != null && entry.projectId !== projectId && entry.memberId !== viewerMemberId;
    return crossProject
      ? { ...entry, projectId: null, projectName: "Busy on another project", projectColour: null, ventureName: null, note: null }
      : entry;
  });
}
