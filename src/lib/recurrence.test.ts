import { describe, expect, it } from "vitest";
import { expandRecurrence } from "./recurrence";

describe("expandRecurrence", () => {
  it("keeps a weekly London entry at the same local time across DST", () => {
    const occurrences = expandRecurrence({
      date: "2026-10-19",
      startTime: "09:00",
      endTime: "12:00",
      timezone: "Europe/London",
      recurrence: { frequency: "weekly", weekdays: [1], until: "2026-11-02" },
    });

    expect(occurrences).toEqual([
      {
        originalDate: "2026-10-19",
        startsAtUtc: "2026-10-19T08:00:00.000Z",
        endsAtUtc: "2026-10-19T11:00:00.000Z",
      },
      {
        originalDate: "2026-10-26",
        startsAtUtc: "2026-10-26T09:00:00.000Z",
        endsAtUtc: "2026-10-26T12:00:00.000Z",
      },
      {
        originalDate: "2026-11-02",
        startsAtUtc: "2026-11-02T09:00:00.000Z",
        endsAtUtc: "2026-11-02T12:00:00.000Z",
      },
    ]);
  });

  it("supports a one-off block that crosses midnight", () => {
    expect(
      expandRecurrence({
        date: "2026-09-01",
        startTime: "22:00",
        endTime: "02:00",
        timezone: "Asia/Kolkata",
        recurrence: null,
      }),
    ).toEqual([
      {
        originalDate: "2026-09-01",
        startsAtUtc: "2026-09-01T16:30:00.000Z",
        endsAtUtc: "2026-09-01T20:30:00.000Z",
      },
    ]);
  });
});
