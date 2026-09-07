import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./db";
import { createEntries, createMember, createProject, createVenture } from "./repository";
import { weeklyStatusForMember } from "./weekly-ledger";

describe("weekly availability ledger", () => {
  let db: Database.Database;
  let member: ReturnType<typeof createMember>;
  let projectId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
    const ventureId = createVenture(db, { name: "Knotie", colour: "#466CFF" }).id;
    projectId = createProject(db, { ventureId, name: "Launch", colour: "#F27D68" }).id;
    member = createMember(db, {
      name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London",
      ventureIds: [ventureId], projectIds: [projectId],
    });
    db.prepare("UPDATE members SET weekly_requirement_start='2026-03-23' WHERE id=?").run(member.id);
    member = { ...member, weeklyRequirementStart: "2026-03-23" };
  });

  function add(date: string, startTime: string, endTime: string, status: "available" | "tentative" | "busy" | "leave" = "available") {
    createEntries(db, member.id, {
      date, startTime, endTime, timezone: member.timezone, status, projectId,
      note: null, leaveCertainty: status === "leave" ? "confirmed" : null, recurrence: null,
    });
  }

  it("counts only unique available minutes", () => {
    add("2026-03-23", "09:00", "17:00");
    add("2026-03-23", "16:00", "18:00");
    add("2026-03-24", "09:00", "17:00", "tentative");
    add("2026-03-25", "09:00", "17:00", "busy");
    add("2026-03-26", "09:00", "17:00", "leave");

    const status = weeklyStatusForMember(db, member, "2026-03-25", "2026-03-23T10:00:00.000Z");

    expect(status).toMatchObject({
      weekStart: "2026-03-23", weekEnd: "2026-03-29", baseTargetHours: 40,
      availableHours: 9, targetHours: 40, remainingHours: 31, complete: false,
    });
  });

  it("carries deficits forward and never banks surplus", () => {
    for (const [date, hours] of [["2026-03-23", 10], ["2026-03-24", 10], ["2026-03-25", 10]] as const) add(date, "08:00", `${8 + hours}:00`);
    for (const date of ["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03"]) add(date, "08:00", "17:00");
    for (const date of ["2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10"]) add(date, "08:00", "18:00");

    expect(weeklyStatusForMember(db, member, "2026-03-23")).toMatchObject({ targetHours: 40, availableHours: 30, remainingHours: 10 });
    expect(weeklyStatusForMember(db, member, "2026-03-30")).toMatchObject({ carryInHours: 10, targetHours: 50, availableHours: 45, remainingHours: 5 });
    expect(weeklyStatusForMember(db, member, "2026-04-06")).toMatchObject({ carryInHours: 5, targetHours: 45, availableHours: 50, remainingHours: 0 });
    expect(weeklyStatusForMember(db, member, "2026-04-13")).toMatchObject({ carryInHours: 0, targetHours: 40, availableHours: 0, remainingHours: 40 });
  });

  it("clamps cross-week time and honours the London daylight-saving transition", () => {
    add("2026-03-28", "23:00", "03:00");
    add("2026-03-29", "23:00", "02:00");

    const first = weeklyStatusForMember(db, member, "2026-03-23");
    const second = weeklyStatusForMember(db, member, "2026-03-30");

    expect(first.availableHours).toBe(4);
    expect(second.availableHours).toBe(2);
  });

  it("returns no target before the start week and marks overdue incomplete weeks for reminders", () => {
    const before = weeklyStatusForMember(db, member, "2026-03-16", "2026-04-01T12:00:00.000Z");
    const due = weeklyStatusForMember(db, member, "2026-03-23", "2026-03-23T08:59:00.000Z");
    const overdue = weeklyStatusForMember(db, member, "2026-03-23", "2026-03-23T09:01:00.000Z");

    expect(before).toMatchObject({ targetHours: 0, remainingHours: 0, reminderNeeded: false });
    expect(due.submissionDueAt).toBe("2026-03-23T09:00:00.000Z");
    expect(due.reminderNeeded).toBe(false);
    expect(overdue.reminderNeeded).toBe(true);
  });
});
