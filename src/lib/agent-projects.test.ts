import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbPool } from "./db";
import { buildAgentProjectDirectory } from "./agent-projects";
import { createMember, createProject, createVenture } from "./repository";
import { createTestDb } from "./test-db";

describe("agent project directory", () => {
  let db: DbPool;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.end();
  });

  it("lists active projects with their venture and assigned members", async () => {
    const ventureId = (await createVenture(db, { name: "Knotie", colour: "#466CFF" })).id;
    const projectId = (await createProject(db, { ventureId, name: "Support", colour: "#F27D68" })).id;
    await createMember(db, {
      name: "Asha",
      email: "asha@example.com",
      location: "London",
      timezone: "Europe/London",
      ventureIds: [ventureId],
      projectIds: [projectId],
    });

    const directory = await buildAgentProjectDirectory(db, "2026-09-07T12:00:00.000Z");

    expect(directory.generatedAt).toBe("2026-09-07T12:00:00.000Z");
    expect(directory.projects).toEqual([expect.objectContaining({
      id: projectId,
      name: "Support",
      memberCount: 1,
      venture: expect.objectContaining({ id: ventureId, name: "Knotie" }),
      members: [expect.objectContaining({ name: "Asha", email: "asha@example.com", timezone: "Europe/London" })],
    })]);
  });
});
