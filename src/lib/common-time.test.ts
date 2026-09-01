import { describe, expect, it } from "vitest";
import { findCommonSlots } from "./common-time";
import type { CalendarEntry } from "./domain";

const entry = (
  memberId: number,
  status: CalendarEntry["status"],
  start: string,
  end: string,
): CalendarEntry => ({
  id: Math.random(),
  memberId,
  projectId: null,
  status,
  note: null,
  leaveCertainty: status === "leave" ? "confirmed" : null,
  startsAtUtc: start,
  endsAtUtc: end,
  originalDate: start.slice(0, 10),
});

describe("findCommonSlots", () => {
  it("intersects split availability and subtracts leave", () => {
    const entries: CalendarEntry[] = [
      entry(1, "available", "2026-09-01T08:00:00.000Z", "2026-09-01T12:00:00.000Z"),
      entry(1, "available", "2026-09-01T13:00:00.000Z", "2026-09-01T17:00:00.000Z"),
      entry(2, "available", "2026-09-01T10:00:00.000Z", "2026-09-01T16:00:00.000Z"),
      entry(2, "leave", "2026-09-01T14:00:00.000Z", "2026-09-01T15:00:00.000Z"),
    ];

    expect(
      findCommonSlots({
        memberIds: [1, 2],
        entries,
        fromUtc: "2026-09-01T00:00:00.000Z",
        toUtc: "2026-09-02T00:00:00.000Z",
        minimumMinutes: 30,
      }),
    ).toEqual([
      { startsAtUtc: "2026-09-01T10:00:00.000Z", endsAtUtc: "2026-09-01T12:00:00.000Z", tentative: false },
      { startsAtUtc: "2026-09-01T13:00:00.000Z", endsAtUtc: "2026-09-01T14:00:00.000Z", tentative: false },
      { startsAtUtc: "2026-09-01T15:00:00.000Z", endsAtUtc: "2026-09-01T16:00:00.000Z", tentative: false },
    ]);
  });

  it("marks a slot tentative when one person only declared tentative time", () => {
    const entries = [
      entry(1, "available", "2026-09-01T08:00:00.000Z", "2026-09-01T10:00:00.000Z"),
      entry(2, "tentative", "2026-09-01T09:00:00.000Z", "2026-09-01T11:00:00.000Z"),
    ];

    expect(
      findCommonSlots({
        memberIds: [1, 2], entries,
        fromUtc: "2026-09-01T00:00:00.000Z", toUtc: "2026-09-02T00:00:00.000Z", minimumMinutes: 30,
      }),
    ).toEqual([
      { startsAtUtc: "2026-09-01T09:00:00.000Z", endsAtUtc: "2026-09-01T10:00:00.000Z", tentative: true },
    ]);
  });
});
