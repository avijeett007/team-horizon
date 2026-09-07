import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbPool } from "./db";
import {
  archiveReference,
  createEntries,
  createMember,
  createProject,
  createVenture,
  deleteOwnedEntry,
  findMemberByEmail,
  listBootstrap,
  listEntries,
  updateOwnedEntry,
} from "./repository";
import { createTestDb } from "./test-db";

describe("calendar repository", () => {
  let db: DbPool;
  let knotieId: number;
  let projectId: number;
  let memberId: number;

  beforeEach(async () => {
    db = await createTestDb();
    knotieId = (await createVenture(db, { name: "Knotie", colour: "#466CFF" })).id;
    projectId = (await createProject(db, { ventureId: knotieId, name: "Launch", colour: "#F27D68" })).id;
    memberId = (await createMember(db, {
      name: "Asha", email: "ASHA@example.com", location: "Bengaluru", timezone: "Asia/Kolkata",
      ventureIds: [knotieId], projectIds: [projectId],
    })).id;
  });

  afterEach(async () => {
    await db.end();
  });

  it("finds a member email case-insensitively", async () => {
    const member = await findMemberByEmail(db, "  asha@EXAMPLE.com ");
    expect(member?.id).toBe(memberId);
    expect(member?.weeklyRequirementStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${member!.weeklyRequirementStart}T12:00:00Z`).getUTCDay()).toBe(1);
  });

  it("creates one materialised entry for every weekly occurrence", async () => {
    const created = await createEntries(db, memberId, {
      date: "2026-09-01", startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
      status: "available", projectId, note: "Focus time", leaveCertainty: null,
      recurrence: { frequency: "weekly", weekdays: [2], until: "2026-09-15" },
    });
    expect(created).toHaveLength(3);
    expect(created[0].startsAtUtc).toBe("2026-09-01T03:30:00.000Z");
    expect(await listEntries(db, "2026-09-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z")).toHaveLength(3);
  });

  it("enforces ownership for entry changes", async () => {
    const [created] = await createEntries(db, memberId, {
      date: "2026-09-01", startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
      status: "available", projectId: null, note: null, leaveCertainty: null, recurrence: null,
    });
    await expect(updateOwnedEntry(db, memberId + 1, created.id, { note: "Changed" })).rejects.toThrow("not found");
    expect(await deleteOwnedEntry(db, memberId + 1, created.id)).toBe(false);
    expect((await updateOwnedEntry(db, memberId, created.id, { note: "Changed" })).note).toBe("Changed");
    expect(await deleteOwnedEntry(db, memberId, created.id)).toBe(true);
  });

  it("archives a venture's projects with the venture", async () => {
    expect(await archiveReference(db, "venture", knotieId)).toBe(true);
    expect((await listBootstrap(db)).projects).toEqual([]);
  });

  it("rolls back a member when one project association is invalid", async () => {
    await expect(createMember(db, {
      name: "Bea", email: "bea@example.com", location: "London", timezone: "Europe/London",
      ventureIds: [knotieId], projectIds: [999_999],
    })).rejects.toThrow();
    expect(await findMemberByEmail(db, "bea@example.com")).toBeNull();
  });

  it("preserves PostgreSQL unique-violation metadata for duplicate email", async () => {
    try {
      await createMember(db, {
        name: "Other Asha", email: "asha@example.com", location: "London", timezone: "Europe/London",
        ventureIds: [knotieId], projectIds: [projectId],
      });
      throw new Error("Expected duplicate member creation to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "23505" });
    }
  });
});
