import { describe, expect, it } from "vitest";
import { commonWindows, summarizeCoverage, summarizeWindow } from "./team-horizon-api.mjs";

const members = [
  { id: 1, name: "Asha", email: "asha@example.com", timezone: "Europe/London" },
  { id: 2, name: "Ben", email: "ben@example.com", timezone: "Asia/Kolkata" },
];

describe("Team Horizon agent calculations", () => {
  it("separates confirmed, tentative, blocked, and undeclared window states", () => {
    const payload = {
      members,
      entries: [
        { memberId: 1, status: "available", startsAtUtc: "2026-09-07T10:00:00Z", endsAtUtc: "2026-09-07T12:00:00Z" },
        { memberId: 1, status: "busy", startsAtUtc: "2026-09-07T10:30:00Z", endsAtUtc: "2026-09-07T11:00:00Z" },
        { memberId: 2, status: "tentative", startsAtUtc: "2026-09-07T10:00:00Z", endsAtUtc: "2026-09-07T12:00:00Z" },
      ],
    };

    const summary = summarizeWindow(payload, "2026-09-07T10:45:00Z", 60);

    expect(summary.availableNow).toEqual([]);
    expect(summary.blockedNow.map((person) => person.email)).toEqual(["asha@example.com"]);
    expect(summary.tentativeNow.map((person) => person.email)).toEqual(["ben@example.com"]);
    expect(summary.availableWithinWindow[0]).toMatchObject({ email: "asha@example.com", availableFromUtc: "2026-09-07T11:00:00.000Z" });
  });

  it("summarizes reminders, missing declarations, and previous-week carry", () => {
    const summary = summarizeCoverage({ weeklyStatus: [
      { memberId: 1, memberName: "Asha", email: "asha@example.com", targetHours: 50, baseTargetHours: 40, carryInHours: 10, availableHours: 35, remainingHours: 15, complete: false, reminderNeeded: true, submissionDueAt: "2026-09-07T08:00:00Z" },
      { memberId: 2, memberName: "Ben", email: "ben@example.com", targetHours: 40, baseTargetHours: 40, carryInHours: 0, availableHours: 0, remainingHours: 40, complete: false, reminderNeeded: false },
    ] });

    expect(summary.reminders[0]).toMatchObject({ email: "asha@example.com", remainingHours: 15, submissionDueAt: "2026-09-07T08:00:00Z" });
    expect(summary.withCarry[0]).toMatchObject({ email: "asha@example.com", carryInHours: 10 });
    expect(summary.missingDeclarations[0]).toMatchObject({ email: "ben@example.com" });
  });

  it("finds confirmed common windows and subtracts busy time", () => {
    const payload = {
      members,
      entries: [
        { memberId: 1, status: "available", startsAtUtc: "2026-09-07T10:00:00Z", endsAtUtc: "2026-09-07T13:00:00Z" },
        { memberId: 1, status: "busy", startsAtUtc: "2026-09-07T11:00:00Z", endsAtUtc: "2026-09-07T11:30:00Z" },
        { memberId: 2, status: "available", startsAtUtc: "2026-09-07T10:30:00Z", endsAtUtc: "2026-09-07T12:00:00Z" },
      ],
    };

    expect(commonWindows(payload, [1, 2], 30)).toEqual([
      { startsAtUtc: "2026-09-07T10:30:00.000Z", endsAtUtc: "2026-09-07T11:00:00.000Z", durationMinutes: 30 },
      { startsAtUtc: "2026-09-07T11:30:00.000Z", endsAtUtc: "2026-09-07T12:00:00.000Z", durationMinutes: 30 },
    ]);
  });

  it("clips common windows to the API's requested range", () => {
    const payload = {
      range: { from: "2026-09-07T10:00:00Z", to: "2026-09-07T12:00:00Z" },
      members,
      entries: [
        { memberId: 1, status: "available", startsAtUtc: "2026-09-07T09:00:00Z", endsAtUtc: "2026-09-07T13:00:00Z" },
        { memberId: 2, status: "available", startsAtUtc: "2026-09-07T09:30:00Z", endsAtUtc: "2026-09-07T12:30:00Z" },
      ],
    };

    expect(commonWindows(payload, [1, 2], 30)).toEqual([
      { startsAtUtc: "2026-09-07T10:00:00.000Z", endsAtUtc: "2026-09-07T12:00:00.000Z", durationMinutes: 120 },
    ]);
  });
});
