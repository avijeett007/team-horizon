import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbPool } from "./db";
import { assertMemberCanUseProject, projectAudience, resolveMemberProject, scopedEntries } from "./project-scope";
import { createEntries, createMember, createProject, createVenture } from "./repository";
import { createTestDb } from "./test-db";

describe("project-scoped visibility", () => {
  let db: DbPool;
  let selectedProjectId: number;
  let otherProjectId: number;
  let viewerId: number;
  let colleagueId: number;
  let outsiderId: number;

  beforeEach(async () => {
    db = await createTestDb();
    const knotieId = (await createVenture(db, { name: "Knotie", colour: "#466CFF" })).id;
    const hexaiId = (await createVenture(db, { name: "Hexai", colour: "#4E9C81" })).id;
    selectedProjectId = (await createProject(db, { ventureId: knotieId, name: "Launch", colour: "#F27D68" })).id;
    otherProjectId = (await createProject(db, { ventureId: hexaiId, name: "Models", colour: "#9B72CF" })).id;
    viewerId = (await createMember(db, { name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London", ventureIds: [knotieId], projectIds: [selectedProjectId] })).id;
    colleagueId = (await createMember(db, { name: "Ben", email: "ben@example.com", location: "Leeds", timezone: "Europe/London", ventureIds: [knotieId, hexaiId], projectIds: [selectedProjectId, otherProjectId] })).id;
    outsiderId = (await createMember(db, { name: "Chitra", email: "chitra@example.com", location: "Pune", timezone: "Asia/Kolkata", ventureIds: [hexaiId], projectIds: [otherProjectId] })).id;
    await createEntries(db, colleagueId, {
      date: "2026-09-08", startTime: "09:00", endTime: "12:00", timezone: "Europe/London",
      status: "busy", projectId: otherProjectId, note: "Private project detail", leaveCertainty: null, recurrence: null,
    });
  });

  afterEach(async () => {
    await db.end();
  });

  it("returns only assigned projects and members of the selected project", async () => {
    const scope = await resolveMemberProject(db, viewerId, selectedProjectId);

    expect(scope.selectableProjects.map((project) => project.id)).toEqual([selectedProjectId]);
    expect(scope.members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
    expect(scope.members.map((member) => member.id)).not.toContain(outsiderId);
    expect(scope.members.find((member) => member.id === colleagueId)?.projectIds).toEqual([selectedProjectId]);
    expect(scope.members.find((member) => member.id === colleagueId)?.ventureIds).toEqual([scope.selectedProject.ventureId]);
    expect(scope.projects.map((project) => project.id)).toEqual([selectedProjectId]);
    expect(scope.ventures.map((venture) => venture.name)).toEqual(["Knotie"]);
  });

  it("defaults to the first active assignment and rejects an inaccessible project", async () => {
    expect((await resolveMemberProject(db, viewerId)).selectedProject.id).toBe(selectedProjectId);
    await expect(resolveMemberProject(db, viewerId, otherProjectId)).rejects.toThrow("Project access is not available");
    await expect(assertMemberCanUseProject(db, viewerId, otherProjectId)).rejects.toThrow("Project access is not available");
  });

  it("redacts another project's details while preserving the colleague's blocked time", async () => {
    const redacted = await scopedEntries(db, selectedProjectId, viewerId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z");
    const ownerView = await scopedEntries(db, selectedProjectId, colleagueId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z");

    expect(redacted).toHaveLength(1);
    expect(redacted[0]).toMatchObject({ memberId: colleagueId, projectId: null, projectName: "Busy on another project", projectColour: null, ventureName: null, note: null });
    expect(ownerView[0]).toMatchObject({ projectId: otherProjectId, projectName: "Models", note: "Private project detail" });
  });

  it("intersects requested member filters with the selected project audience", async () => {
    expect(await scopedEntries(db, selectedProjectId, viewerId, "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z", [outsiderId])).toEqual([]);
    expect((await projectAudience(db, selectedProjectId)).members.map((member) => member.id)).toEqual([viewerId, colleagueId]);
  });
});
