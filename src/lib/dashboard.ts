import { DateTime } from "luxon";
import type { Member } from "./domain";
import type { DisplayEntry } from "./repository";

export interface DashboardSummary {
  availableNow: Member[];
  onLeaveToday: Member[];
  nextAvailable: Array<{ member: Member; startsAtUtc: string }>;
  needsUpdate: Member[];
  horizon: DisplayEntry[];
}

export function buildDashboard(input: { now: string; zone: string; members: Member[]; entries: DisplayEntry[] }): DashboardSummary {
  const now = DateTime.fromISO(input.now, { setZone: true });
  const dayStart = now.setZone(input.zone).startOf("day").toUTC().toMillis();
  const dayEnd = now.setZone(input.zone).endOf("day").toUTC().toMillis();
  const updateEnd = now.setZone(input.zone).startOf("day").plus({ days: 7 }).endOf("day").toUTC().toMillis();
  const nowMs = now.toMillis();
  const activeMembers = input.members.filter((member) => member.active);
  const overlaps = (entry: DisplayEntry, start: number, end: number) => Date.parse(entry.endsAtUtc) > start && Date.parse(entry.startsAtUtc) < end;
  const forMember = (member: Member) => input.entries.filter((entry) => entry.memberId === member.id);

  const availableNow = activeMembers.filter((member) => {
    const covering = forMember(member).filter((entry) => Date.parse(entry.startsAtUtc) <= nowMs && Date.parse(entry.endsAtUtc) > nowMs);
    return covering.some((entry) => entry.status === "available" || entry.status === "tentative")
      && !covering.some((entry) => entry.status === "busy" || entry.status === "leave");
  });
  const onLeaveToday = activeMembers.filter((member) => forMember(member).some((entry) => entry.status === "leave" && overlaps(entry, dayStart, dayEnd)));
  const needsUpdate = activeMembers.filter((member) => !forMember(member).some((entry) =>
    (entry.status === "available" || entry.status === "tentative" || entry.status === "leave")
    && overlaps(entry, dayStart, updateEnd),
  ));
  const nextAvailable = activeMembers.flatMap((member) => {
    const next = forMember(member)
      .filter((entry) => (entry.status === "available" || entry.status === "tentative") && Date.parse(entry.startsAtUtc) > nowMs)
      .sort((a, b) => Date.parse(a.startsAtUtc) - Date.parse(b.startsAtUtc))[0];
    return next ? [{ member, startsAtUtc: next.startsAtUtc }] : [];
  }).sort((a, b) => Date.parse(a.startsAtUtc) - Date.parse(b.startsAtUtc));

  return {
    availableNow,
    onLeaveToday,
    nextAvailable,
    needsUpdate,
    horizon: input.entries.filter((entry) => overlaps(entry, dayStart, dayEnd)),
  };
}
