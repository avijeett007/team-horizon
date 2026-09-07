import { DateTime } from "luxon";
import type { DbQueryable } from "./db";
import { listBootstrap } from "./repository";

export async function buildAgentProjectDirectory(db: DbQueryable, generatedAt = DateTime.utc().toISO()!) {
  const data = await listBootstrap(db);
  return {
    generatedAt,
    projects: data.projects.map((project) => {
      const venture = data.ventures.find((item) => item.id === project.ventureId);
      const members = data.members
        .filter((member) => member.projectIds.includes(project.id))
        .map(({ id, name, email, location, timezone }) => ({ id, name, email, location, timezone }));
      return {
        ...project,
        venture: venture ? { id: venture.id, name: venture.name, colour: venture.colour } : null,
        memberCount: members.length,
        members,
      };
    }),
  };
}
