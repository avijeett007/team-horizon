import { DateTime } from "luxon";
import type { DbQueryable } from "./db";
import type { Member } from "./domain";
import { listEntries } from "./repository";

export const BASE_WEEKLY_TARGET_MINUTES = 2_400;

export interface WeeklyStatus {
  memberId: number;
  memberName: string;
  email: string;
  timezone: string;
  weekStart: string;
  weekEnd: string;
  baseTargetHours: number;
  carryInHours: number;
  targetHours: number;
  availableHours: number;
  remainingHours: number;
  complete: boolean;
  submissionDueAt: string;
  reminderNeeded: boolean;
}

function mondayFor(value: string, zone: string): DateTime {
  const date = DateTime.fromISO(value, { zone }).startOf("day");
  if (!date.isValid) throw new Error("week must be a valid ISO date");
  return date.minus({ days: date.weekday - 1 });
}

async function uniqueAvailableMinutes(db: DbQueryable, memberId: number, weekStart: DateTime): Promise<number> {
  const weekEnd = weekStart.plus({ days: 7 });
  const lower = weekStart.toUTC().toMillis();
  const upper = weekEnd.toUTC().toMillis();
  const ranges = (await listEntries(db, weekStart.toUTC().toISO()!, weekEnd.toUTC().toISO()!, [memberId]))
    .filter((entry) => entry.status === "available")
    .map((entry) => [Math.max(lower, Date.parse(entry.startsAtUtc)), Math.min(upper, Date.parse(entry.endsAtUtc))] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let totalMilliseconds = 0;
  let activeStart = -1;
  let activeEnd = -1;
  for (const [start, end] of ranges) {
    if (activeStart < 0) {
      activeStart = start;
      activeEnd = end;
    } else if (start <= activeEnd) {
      activeEnd = Math.max(activeEnd, end);
    } else {
      totalMilliseconds += activeEnd - activeStart;
      activeStart = start;
      activeEnd = end;
    }
  }
  if (activeStart >= 0) totalMilliseconds += activeEnd - activeStart;
  return Math.round(totalMilliseconds / 60_000);
}

const hours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;

export async function weeklyStatusForMember(
  db: DbQueryable,
  member: Member,
  weekDate: string,
  nowUtc = DateTime.utc().toISO()!,
): Promise<WeeklyStatus> {
  const requestedWeek = mondayFor(weekDate, member.timezone);
  const requirementWeek = mondayFor(member.weeklyRequirementStart, member.timezone);
  const due = requestedWeek.plus({ hours: 9 }).toUTC();
  const weekEnd = requestedWeek.plus({ days: 6 });
  const base = {
    memberId: member.id,
    memberName: member.name,
    email: member.email,
    timezone: member.timezone,
    weekStart: requestedWeek.toISODate()!,
    weekEnd: weekEnd.toISODate()!,
    baseTargetHours: hours(BASE_WEEKLY_TARGET_MINUTES),
    submissionDueAt: due.toISO()!,
  };

  if (requestedWeek.toMillis() < requirementWeek.toMillis()) {
    return { ...base, carryInHours: 0, targetHours: 0, availableHours: 0, remainingHours: 0, complete: true, reminderNeeded: false };
  }

  let carryMinutes = 0;
  let requestedAvailable = 0;
  let requestedTarget = BASE_WEEKLY_TARGET_MINUTES;
  let cursor = requirementWeek;
  while (cursor.toMillis() <= requestedWeek.toMillis()) {
    const availableMinutes = await uniqueAvailableMinutes(db, member.id, cursor);
    const targetMinutes = BASE_WEEKLY_TARGET_MINUTES + carryMinutes;
    if (cursor.toMillis() === requestedWeek.toMillis()) {
      requestedAvailable = availableMinutes;
      requestedTarget = targetMinutes;
    }
    carryMinutes = Math.max(0, targetMinutes - availableMinutes);
    cursor = cursor.plus({ days: 7 });
  }

  const openingCarry = requestedTarget - BASE_WEEKLY_TARGET_MINUTES;
  const complete = carryMinutes === 0;
  const now = DateTime.fromISO(nowUtc, { zone: "utc" });
  if (!now.isValid) throw new Error("nowUtc must be a valid ISO timestamp");
  return {
    ...base,
    carryInHours: hours(openingCarry),
    targetHours: hours(requestedTarget),
    availableHours: hours(requestedAvailable),
    remainingHours: hours(carryMinutes),
    complete,
    reminderNeeded: !complete && now.toMillis() > due.toMillis(),
  };
}

export async function weeklyStatusesForMembers(
  db: DbQueryable,
  members: Member[],
  weekDate: string,
  nowUtc?: string,
): Promise<WeeklyStatus[]> {
  return Promise.all(members.map((member) => weeklyStatusForMember(db, member, weekDate, nowUtc)));
}
