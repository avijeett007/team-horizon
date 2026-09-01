import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./db";
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

describe("calendar repository", () => {
  let db: Database.Database;
  let knotieId: number;
  let projectId: number;
  let memberId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
    knotieId = createVenture(db, { name: "Knotie", colour: "#466CFF" }).id;
    projectId = createProject(db, { ventureId: knotieId, name: "Launch", colour: "#F27D68" }).id;
    memberId = createMember(db, {
      name: "Asha", email: "ASHA@example.com", location: "Bengaluru", timezone: "Asia/Kolkata",
      ventureIds: [knotieId], projectIds: [projectId],
    }).id;
  });

  it("finds a member email case-insensitively", () => {
    expect(findMemberByEmail(db, "  asha@EXAMPLE.com ")?.id).toBe(memberId);
  });

  it("creates one materialised entry for every weekly occurrence", () => {
    const created = createEntries(db, memberId, {
      date: "2026-09-01", startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
      status: "available", projectId, note: "Focus time", leaveCertainty: null,
      recurrence: { frequency: "weekly", weekdays: [2], until: "2026-09-15" },
    });
    expect(created).toHaveLength(3);
    expect(listEntries(db, "2026-09-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z")).toHaveLength(3);
  });

  it("enforces ownership for entry changes", () => {
    const [created] = createEntries(db, memberId, {
      date: "2026-09-01", startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
      status: "available", projectId: null, note: null, leaveCertainty: null, recurrence: null,
    });
    expect(() => updateOwnedEntry(db, memberId + 1, created.id, { note: "Changed" })).toThrow("not found");
    expect(deleteOwnedEntry(db, memberId + 1, created.id)).toBe(false);
    expect(updateOwnedEntry(db, memberId, created.id, { note: "Changed" }).note).toBe("Changed");
    expect(deleteOwnedEntry(db, memberId, created.id)).toBe(true);
  });

  it("archives a venture's projects with the venture", () => {
    expect(archiveReference(db, "venture", knotieId)).toBe(true);
    expect(listBootstrap(db).projects).toEqual([]);
  });
});
