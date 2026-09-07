import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertRequestedMembersInProject, assertWritableProject, buildMemberBootstrap, requireProjectId } from "./api-policy";
import type { DbPool } from "./db";
import { createMember, createProject, createVenture } from "./repository";
import { createTestDb } from "./test-db";

describe("member API policy", () => {
  let db: DbPool;
  let projectId: number;
  let unrelatedProjectId: number;
  let viewerId: number;
  let colleagueId: number;
  let outsiderId: number;

  beforeEach(async () => {
    db = await createTestDb();
    const ventureId = (await createVenture(db, { name: "Knotie", colour: "#466CFF" })).id;
    const otherVentureId = (await createVenture(db, { name: "Hexai", colour: "#4E9C81" })).id;
    projectId = (await createProject(db, { ventureId, name: "Launch", colour: "#F27D68" })).id;
    unrelatedProjectId = (await createProject(db, { ventureId: otherVentureId, name: "Models", colour: "#9B72CF" })).id;
    viewerId = (await createMember(db, { name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London", ventureIds: [ventureId], projectIds: [projectId] })).id;
    colleagueId = (await createMember(db, { name: "Ben", email: "ben@example.com", location: "Leeds", timezone: "Europe/London", ventureIds: [ventureId], projectIds: [projectId] })).id;
    outsiderId = (await createMember(db, { name: "Chitra", email: "chitra@example.com", location: "Pune", timezone: "Asia/Kolkata", ventureIds: [otherVentureId], projectIds: [unrelatedProjectId] })).id;
  });

  afterEach(async () => {
    await db.end();
  });

  it("builds a bootstrap payload containing only the selected project audience", async () => {
    const payload = await buildMemberBootstrap(db, viewerId, projectId);

    expect(payload.members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
    expect(payload.members.map((member) => member.id)).not.toContain(outsiderId);
    expect(payload.selectedProject.id).toBe(projectId);
    expect(payload.selectableProjects.map((project) => project.id)).toEqual([projectId]);
  });

  it("rejects inaccessible entry projects and unrelated common-time members", async () => {
    await expect(assertWritableProject(db, viewerId, unrelatedProjectId)).rejects.toThrow("Project access is not available");
    await expect(assertWritableProject(db, viewerId, null)).resolves.toBeUndefined();
    await expect(assertRequestedMembersInProject(db, projectId, [viewerId, outsiderId])).rejects.toThrow("Selected people must belong to this project");
    await expect(assertRequestedMembersInProject(db, projectId, [viewerId, colleagueId])).resolves.toEqual([viewerId, colleagueId]);
  });

  it("requires a positive numeric projectId query value", () => {
    expect(requireProjectId(new URLSearchParams("projectId=12"))).toBe(12);
    expect(() => requireProjectId(new URLSearchParams())).toThrow("projectId is required");
    expect(() => requireProjectId(new URLSearchParams("projectId=nope"))).toThrow("projectId must be a positive integer");
  });
});
