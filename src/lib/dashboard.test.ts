import { describe, expect, it } from "vitest";
import type { Member } from "./domain";
import { buildDashboard } from "./dashboard";
import type { DisplayEntry } from "./repository";

const members: Member[] = [
  { id: 1, name: "Asha", email: "asha@example.com", location: "Bengaluru", timezone: "Asia/Kolkata", active: true, ventureIds: [], projectIds: [] },
  { id: 2, name: "Tom", email: "tom@example.com", location: "London", timezone: "Europe/London", active: true, ventureIds: [], projectIds: [] },
  { id: 3, name: "Archived", email: "old@example.com", location: "London", timezone: "Europe/London", active: false, ventureIds: [], projectIds: [] },
];

const entry = (memberId: number, status: DisplayEntry["status"], start: string, end: string): DisplayEntry => ({
  id: memberId, memberId, seriesId: null, projectId: null, status, note: null,
  leaveCertainty: status === "leave" ? "confirmed" : null, startsAtUtc: start, endsAtUtc: end,
  originalDate: start.slice(0, 10), memberName: members.find((m) => m.id === memberId)!.name,
  memberTimezone: members.find((m) => m.id === memberId)!.timezone,
  projectName: null, projectColour: null, ventureName: null,
});

describe("buildDashboard", () => {
  it("shows current declarations and neutral seven-day update gaps", () => {
    const summary = buildDashboard({
      now: "2026-09-01T10:00:00.000Z",
      zone: "Europe/London",
      members,
      entries: [entry(1, "available", "2026-09-01T09:00:00.000Z", "2026-09-01T12:00:00.000Z")],
    });

    expect(summary.availableNow.map((person) => person.id)).toEqual([1]);
    expect(summary.needsUpdate.map((person) => person.id)).toEqual([2]);
    expect(summary.needsUpdate.some((person) => person.id === 3)).toBe(false);
  });
});
