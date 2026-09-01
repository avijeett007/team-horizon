import { DateTime } from "luxon";

export interface RecurrenceRule {
  frequency: "daily" | "weekdays" | "weekly" | "custom";
  weekdays?: number[];
  until: string;
}

export interface RecurrenceInput {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  recurrence: RecurrenceRule | null;
}

export interface OccurrenceInput {
  originalDate: string;
  startsAtUtc: string;
  endsAtUtc: string;
}

function assertValid(dt: DateTime, label: string): void {
  if (!dt.isValid) throw new Error(`${label} is invalid`);
}

export function expandRecurrence(input: RecurrenceInput): OccurrenceInput[] {
  const firstDate = DateTime.fromISO(input.date, { zone: input.timezone }).startOf("day");
  assertValid(firstDate, "Date or time zone");
  const until = input.recurrence
    ? DateTime.fromISO(input.recurrence.until, { zone: input.timezone }).startOf("day")
    : firstDate;
  assertValid(until, "Recurrence end date");
  if (until < firstDate) throw new Error("Recurrence end date must not be before the first date");
  if (until.diff(firstDate, "days").days > 366) throw new Error("Recurrence cannot exceed 366 days");

  const selectedWeekdays = input.recurrence?.frequency === "weekdays"
    ? [1, 2, 3, 4, 5]
    : input.recurrence?.weekdays ?? [firstDate.weekday];
  const output: OccurrenceInput[] = [];

  for (let cursor = firstDate; cursor <= until; cursor = cursor.plus({ days: 1 })) {
    const include = !input.recurrence
      || input.recurrence.frequency === "daily"
      || selectedWeekdays.includes(cursor.weekday);
    if (!include) continue;

    let start = DateTime.fromISO(`${cursor.toISODate()}T${input.startTime}`, { zone: input.timezone });
    let end = DateTime.fromISO(`${cursor.toISODate()}T${input.endTime}`, { zone: input.timezone });
    assertValid(start, "Start time");
    assertValid(end, "End time");
    if (end <= start) end = end.plus({ days: 1 });
    output.push({
      originalDate: cursor.toISODate()!,
      startsAtUtc: start.toUTC().toISO()!,
      endsAtUtc: end.toUTC().toISO()!,
    });
  }

  return output;
}
