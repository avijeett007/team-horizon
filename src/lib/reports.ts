import { DateTime } from "luxon";
import type { DbQueryable } from "./db";
import { projectAudience } from "./project-scope";
import { weeklyStatusesForMembers, type WeeklyStatus } from "./weekly-ledger";

export const LEDGER_DEFINITIONS = {
  accountingWeek: "Monday through Sunday in each member's timezone",
  countedTime: "Only available entries count; tentative, busy, and leave entries do not",
  target: "40 hours per person across all projects, plus any outstanding deficit",
};

function mondayDate(value: string): string {
  const date = DateTime.fromISO(value, { zone: "utc" }).startOf("day");
  if (!date.isValid) throw new Error("week must be a valid ISO date");
  return date.minus({ days: date.weekday - 1 }).toISODate()!;
}

export async function buildWeeklyReport(db: DbQueryable, projectId: number, week: string, nowUtc = DateTime.utc().toISO()!) {
  const audience = await projectAudience(db, projectId);
  const weekStart = mondayDate(week);
  const members = await weeklyStatusesForMembers(db, audience.members, weekStart, nowUtc);
  return {
    generatedAt: nowUtc,
    project: audience.selectedProject,
    venture: audience.ventures[0],
    weekStart,
    weekEnd: DateTime.fromISO(weekStart, { zone: "utc" }).plus({ days: 6 }).toISODate()!,
    definitions: LEDGER_DEFINITIONS,
    members,
  };
}

export interface MonthlyMemberReport {
  memberId: number;
  memberName: string;
  email: string;
  timezone: string;
  totalBaseTargetHours: number;
  totalAvailableHours: number;
  openingCarryHours: number;
  closingDeficitHours: number;
  completedWeeks: number;
  totalWeeks: number;
  weeklyStatuses: WeeklyStatus[];
}

export async function buildMonthlyReport(db: DbQueryable, projectId: number, month: string, nowUtc = DateTime.utc().toISO()!) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must use YYYY-MM");
  const first = DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" }).startOf("month");
  if (!first.isValid || first.toFormat("yyyy-MM") !== month) throw new Error("month must use YYYY-MM");
  const last = first.endOf("month");
  let cursor = first.plus({ days: (8 - first.weekday) % 7 });
  const weeks: string[] = [];
  while (cursor.toMillis() <= last.toMillis()) {
    weeks.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 7 });
  }

  const audience = await projectAudience(db, projectId);
  const members: MonthlyMemberReport[] = await Promise.all(audience.members.map(async (member) => {
    const weeklyStatuses = await Promise.all(weeks.map(async (week) => (await weeklyStatusesForMembers(db, [member], week, nowUtc))[0]));
    return {
      memberId: member.id,
      memberName: member.name,
      email: member.email,
      timezone: member.timezone,
      totalBaseTargetHours: weeklyStatuses.reduce((total, status) => total + status.baseTargetHours, 0),
      totalAvailableHours: Math.round(weeklyStatuses.reduce((total, status) => total + status.availableHours, 0) * 100) / 100,
      openingCarryHours: weeklyStatuses[0]?.carryInHours ?? 0,
      closingDeficitHours: weeklyStatuses.at(-1)?.remainingHours ?? 0,
      completedWeeks: weeklyStatuses.filter((status) => status.targetHours > 0 && status.complete).length,
      totalWeeks: weeklyStatuses.filter((status) => status.targetHours > 0).length,
      weeklyStatuses,
    };
  }));

  return { generatedAt: nowUtc, project: audience.selectedProject, venture: audience.ventures[0], month, weeks, definitions: LEDGER_DEFINITIONS, members };
}
