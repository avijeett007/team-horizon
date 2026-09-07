import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./db";
import { buildMonthlyReport, buildWeeklyReport } from "./reports";
import { createEntries, createMember, createProject, createVenture } from "./repository";

describe("availability reports", () => {
  let db: Database.Database;
  let memberId: number;
  let projectId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
    const ventureId = createVenture(db, { name: "Knotie", colour: "#466CFF" }).id;
    projectId = createProject(db, { ventureId, name: "Launch", colour: "#F27D68" }).id;
    memberId = createMember(db, { name: "Asha", email: "asha@example.com", location: "London", timezone: "Europe/London", ventureIds: [ventureId], projectIds: [projectId] }).id;
    db.prepare("UPDATE members SET weekly_requirement_start='2026-08-31' WHERE id=?").run(memberId);
  });

  function addDay(date: string, endHour: number) {
    createEntries(db, memberId, {
      date, startTime: "08:00", endTime: `${String(endHour).padStart(2, "0")}:00`, timezone: "Europe/London",
      status: "available", projectId, note: null, leaveCertainty: null, recurrence: null,
    });
  }

  function addWeek(monday: string, hoursPerDay: number) {
    const start = new Date(`${monday}T12:00:00Z`);
    for (let day = 0; day < 5; day += 1) {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + day);
      addDay(date.toISOString().slice(0, 10), 8 + hoursPerDay);
    }
  }

  it("reports a project's members using each person's global carry balance", () => {
    addWeek("2026-08-31", 6);
    addWeek("2026-09-07", 8);

    const report = buildWeeklyReport(db, projectId, "2026-09-07", "2026-09-07T10:00:00.000Z");

    expect(report.project).toMatchObject({ id: projectId, name: "Launch" });
    expect(report.members[0]).toMatchObject({ targetHours: 50, availableHours: 40, carryInHours: 10, remainingHours: 10, reminderNeeded: true });
  });

  it("aggregates all Monday-starting weeks in a calendar month", () => {
    addWeek("2026-08-31", 6);
    addWeek("2026-09-07", 8);
    addWeek("2026-09-14", 10);
    addWeek("2026-09-21", 8);
    addWeek("2026-09-28", 7);

    const report = buildMonthlyReport(db, projectId, "2026-09", "2026-10-01T12:00:00.000Z");

    expect(report.weeks).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(report.members[0]).toMatchObject({
      totalBaseTargetHours: 160,
      totalAvailableHours: 165,
      openingCarryHours: 10,
      closingDeficitHours: 5,
      completedWeeks: 2,
    });
  });

  it("rejects invalid report dates", () => {
    expect(() => buildWeeklyReport(db, projectId, "not-a-date")).toThrow("week must be a valid ISO date");
    expect(() => buildMonthlyReport(db, projectId, "2026-13")).toThrow("month must use YYYY-MM");
  });
});
