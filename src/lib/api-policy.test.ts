import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { assertRequestedMembersInProject, assertWritableProject, buildMemberBootstrap, requireProjectId } from "./api-policy";
import { migrate } from "./db";
import { createMember, createProject, createVenture } from "./repository";

describe("member API policy", () => {
  let db: Database.Database;
  let projectId: number;
  let unrelatedProjectId: number;
  let viewerId: number;
  let colleagueId: number;
  let outsiderId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
    const ventureId = createVenture(db, { name: "Knotie", colour: "#466CFF" }).id;
    const otherVentureId = createVenture(db, { name: "Hexai", colour: "#4E9C81" }).id;
    projectId = createProject(db, { ventureId, name: "Launch", colour: "#F27D68" }).id;
    unrelatedProjectId = createProject(db, { ventureId: otherVentureId, name: "Models", colour: "#9B72CF" }).id;
    viewerId = createMember(db, { name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London", ventureIds: [ventureId], projectIds: [projectId] }).id;
    colleagueId = createMember(db, { name: "Ben", email: "ben@example.com", location: "Leeds", timezone: "Europe/London", ventureIds: [ventureId], projectIds: [projectId] }).id;
    outsiderId = createMember(db, { name: "Chitra", email: "chitra@example.com", location: "Pune", timezone: "Asia/Kolkata", ventureIds: [otherVentureId], projectIds: [unrelatedProjectId] }).id;
  });

  it("builds a bootstrap payload containing only the selected project audience", () => {
    const payload = buildMemberBootstrap(db, viewerId, projectId);

    expect(payload.members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
    expect(payload.members.map((member) => member.id)).not.toContain(outsiderId);
    expect(payload.selectedProject.id).toBe(projectId);
    expect(payload.selectableProjects.map((project) => project.id)).toEqual([projectId]);
  });

  it("rejects inaccessible entry projects and unrelated common-time members", () => {
    expect(() => assertWritableProject(db, viewerId, unrelatedProjectId)).toThrow("Project access is not available");
    expect(() => assertWritableProject(db, viewerId, null)).not.toThrow();
    expect(() => assertRequestedMembersInProject(db, projectId, [viewerId, outsiderId])).toThrow("Selected people must belong to this project");
    expect(assertRequestedMembersInProject(db, projectId, [viewerId, colleagueId])).toEqual([viewerId, colleagueId]);
  });

  it("requires a positive numeric projectId query value", () => {
    expect(requireProjectId(new URLSearchParams("projectId=12"))).toBe(12);
    expect(() => requireProjectId(new URLSearchParams())).toThrow("projectId is required");
    expect(() => requireProjectId(new URLSearchParams("projectId=nope"))).toThrow("projectId must be a positive integer");
  });
});
