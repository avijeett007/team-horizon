import type { CalendarEntry } from "./domain";

export interface CommonTimeInput {
  memberIds: number[];
  entries: CalendarEntry[];
  fromUtc: string;
  toUtc: string;
  minimumMinutes: number;
}

export interface CommonSlot {
  startsAtUtc: string;
  endsAtUtc: string;
  tentative: boolean;
}

export function findCommonSlots(input: CommonTimeInput): CommonSlot[] {
  if (input.memberIds.length < 2) return [];
  const from = Date.parse(input.fromUtc);
  const to = Date.parse(input.toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];

  const relevant = input.entries.filter((entry) =>
    input.memberIds.includes(entry.memberId)
    && Date.parse(entry.endsAtUtc) > from
    && Date.parse(entry.startsAtUtc) < to,
  );
  const boundaries = new Set<number>([from, to]);
  for (const entry of relevant) {
    boundaries.add(Math.max(from, Date.parse(entry.startsAtUtc)));
    boundaries.add(Math.min(to, Date.parse(entry.endsAtUtc)));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const slots: Array<{ start: number; end: number; tentative: boolean }> = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const midpoint = start + (end - start) / 2;
    let tentative = false;
    let everyoneAvailable = true;

    for (const memberId of input.memberIds) {
      const covering = relevant.filter((entry) =>
        entry.memberId === memberId
        && Date.parse(entry.startsAtUtc) <= midpoint
        && Date.parse(entry.endsAtUtc) >= midpoint,
      );
      if (covering.some((entry) => entry.status === "busy" || entry.status === "leave")) {
        everyoneAvailable = false;
        break;
      }
      const hasAvailable = covering.some((entry) => entry.status === "available");
      const hasTentative = covering.some((entry) => entry.status === "tentative");
      if (!hasAvailable && !hasTentative) {
        everyoneAvailable = false;
        break;
      }
      if (!hasAvailable && hasTentative) tentative = true;
    }

    if (!everyoneAvailable) continue;
    const previous = slots.at(-1);
    if (previous && previous.end === start && previous.tentative === tentative) previous.end = end;
    else slots.push({ start, end, tentative });
  }

  return slots
    .filter((slot) => slot.end - slot.start >= input.minimumMinutes * 60_000)
    .map((slot) => ({
      startsAtUtc: new Date(slot.start).toISOString(),
      endsAtUtc: new Date(slot.end).toISOString(),
      tentative: slot.tentative,
    }));
}
