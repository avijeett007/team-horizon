import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./db";
import { assertMemberCanUseProject, projectAudience, resolveMemberProject, scopedEntries } from "./project-scope";
import { createEntries, createMember, createProject, createVenture } from "./repository";

describe("project-scoped visibility", () => {
  let db: Database.Database;
  let selectedProjectId: number;
  let otherProjectId: number;
  let viewerId: number;
  let colleagueId: number;
  let outsiderId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
    const knotieId = createVenture(db, { name: "Knotie", colour: "#466CFF" }).id;
    const hexaiId = createVenture(db, { name: "Hexai", colour: "#4E9C81" }).id;
    selectedProjectId = createProject(db, { ventureId: knotieId, name: "Launch", colour: "#F27D68" }).id;
    otherProjectId = createProject(db, { ventureId: hexaiId, name: "Models", colour: "#9B72CF" }).id;
    viewerId = createMember(db, { name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London", ventureIds: [knotieId], projectIds: [selectedProjectId] }).id;
    colleagueId = createMember(db, { name: "Ben", email: "ben@example.com", location: "Leeds", timezone: "Europe/London", ventureIds: [knotieId, hexaiId], projectIds: [selectedProjectId, otherProjectId] }).id;
    outsiderId = createMember(db, { name: "Chitra", email: "chitra@example.com", location: "Pune", timezone: "Asia/Kolkata", ventureIds: [hexaiId], projectIds: [otherProjectId] }).id;
    createEntries(db, colleagueId, {
      date: "2026-09-08", startTime: "09:00", endTime: "12:00", timezone: "Europe/London",
      status: "busy", projectId: otherProjectId, note: "Private project detail", leaveCertainty: null, recurrence: null,
    });
  });

  it("returns only assigned projects and members of the selected project", () => {
    const scope = resolveMemberProject(db, viewerId, selectedProjectId);

    expect(scope.selectableProjects.map((project) => project.id)).toEqual([selectedProjectId]);
    expect(scope.members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
    expect(scope.members.map((member) => member.id)).not.toContain(outsiderId);
    expect(scope.projects.map((project) => project.id)).toEqual([selectedProjectId]);
    expect(scope.ventures.map((venture) => venture.name)).toEqual(["Knotie"]);
  });

  it("defaults to the first active assignment and rejects an inaccessible project", () => {
    expect(resolveMemberProject(db, viewerId).selectedProject.id).toBe(selectedProjectId);
    expect(() => resolveMemberProject(db, viewerId, otherProjectId)).toThrow("Project access is not available");
    expect(() => assertMemberCanUseProject(db, viewerId, otherProjectId)).toThrow("Project access is not available");
  });

  it("redacts another project's details while preserving the colleague's blocked time", () => {
    const redacted = scopedEntries(db, selectedProjectId, viewerId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z");
    const ownerView = scopedEntries(db, selectedProjectId, colleagueId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z");

    expect(redacted).toHaveLength(1);
    expect(redacted[0]).toMatchObject({ memberId: colleagueId, projectId: null, projectName: "Busy on another project", projectColour: null, ventureName: null, note: null });
    expect(ownerView[0]).toMatchObject({ projectId: otherProjectId, projectName: "Models", note: "Private project detail" });
  });

  it("intersects requested member filters with the selected project audience", () => {
    expect(scopedEntries(db, selectedProjectId, viewerId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z", [outsiderId])).toEqual([]);
    expect(projectAudience(db, selectedProjectId).members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
  });
});
