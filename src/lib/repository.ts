import type Database from "better-sqlite3";
import type { CalendarEntry, CalendarStatus, LeaveCertainty, Member, Project, Venture } from "./domain";
import { expandRecurrence, type RecurrenceRule } from "./recurrence";

type Sqlite = Database.Database;

export interface MemberInput {
  name: string;
  email: string;
  location: string;
  timezone: string;
  ventureIds: number[];
  projectIds: number[];
}

export interface EntryInput {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: CalendarStatus;
  projectId: number | null;
  note: string | null;
  leaveCertainty: LeaveCertainty | null;
  recurrence: RecurrenceRule | null;
}

export interface DisplayEntry extends CalendarEntry {
  memberName: string;
  memberTimezone: string;
  projectName: string | null;
  projectColour: string | null;
  ventureName: string | null;
}

const bool = (value: unknown) => Boolean(value);

function mapMember(db: Sqlite, row: Record<string, unknown>): Member {
  return {
    id: Number(row.id), name: String(row.name), email: String(row.email), location: String(row.location),
    timezone: String(row.timezone), active: bool(row.active),
    ventureIds: (db.prepare("SELECT venture_id id FROM member_ventures WHERE member_id = ?").all(row.id) as Array<{ id: number }>).map((item) => item.id),
    projectIds: (db.prepare("SELECT project_id id FROM member_projects WHERE member_id = ?").all(row.id) as Array<{ id: number }>).map((item) => item.id),
  };
}

export function createVenture(db: Sqlite, input: { name: string; colour: string }): Venture {
  const result = db.prepare("INSERT INTO ventures(name, colour) VALUES (?, ?)").run(input.name.trim(), input.colour);
  return { id: Number(result.lastInsertRowid), name: input.name.trim(), colour: input.colour, active: true };
}

export function createProject(db: Sqlite, input: { ventureId: number; name: string; colour: string }): Project {
  const result = db.prepare("INSERT INTO projects(venture_id, name, colour) VALUES (?, ?, ?)").run(input.ventureId, input.name.trim(), input.colour);
  return { id: Number(result.lastInsertRowid), ventureId: input.ventureId, name: input.name.trim(), colour: input.colour, active: true };
}

export function createMember(db: Sqlite, input: MemberInput): Member {
  return db.transaction(() => {
    const result = db.prepare("INSERT INTO members(name, email, location, timezone) VALUES (?, ?, ?, ?)")
      .run(input.name.trim(), input.email.trim().toLowerCase(), input.location.trim(), input.timezone);
    const id = Number(result.lastInsertRowid);
    const addVenture = db.prepare("INSERT INTO member_ventures(member_id, venture_id) VALUES (?, ?)");
    const addProject = db.prepare("INSERT INTO member_projects(member_id, project_id) VALUES (?, ?)");
    for (const ventureId of input.ventureIds) addVenture.run(id, ventureId);
    for (const projectId of input.projectIds) addProject.run(id, projectId);
    return { id, ...input, name: input.name.trim(), email: input.email.trim().toLowerCase(), location: input.location.trim(), active: true };
  })();
}

export function updateMember(db: Sqlite, id: number, input: MemberInput & { active?: boolean }): Member {
  return db.transaction(() => {
    const result = db.prepare("UPDATE members SET name=?, email=?, location=?, timezone=?, active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(input.name.trim(), input.email.trim().toLowerCase(), input.location.trim(), input.timezone, input.active === false ? 0 : 1, id);
    if (!result.changes) throw new Error("Member not found");
    db.prepare("DELETE FROM member_ventures WHERE member_id=?").run(id);
    db.prepare("DELETE FROM member_projects WHERE member_id=?").run(id);
    const addVenture = db.prepare("INSERT INTO member_ventures(member_id, venture_id) VALUES (?, ?)");
    const addProject = db.prepare("INSERT INTO member_projects(member_id, project_id) VALUES (?, ?)");
    for (const ventureId of input.ventureIds) addVenture.run(id, ventureId);
    for (const projectId of input.projectIds) addProject.run(id, projectId);
    return findMemberById(db, id)!;
  })();
}

export function findMemberByEmail(db: Sqlite, email: string): Member | null {
  const row = db.prepare("SELECT * FROM members WHERE email = ? COLLATE NOCASE AND active = 1").get(email.trim()) as Record<string, unknown> | undefined;
  return row ? mapMember(db, row) : null;
}

export function findMemberById(db: Sqlite, id: number): Member | null {
  const row = db.prepare("SELECT * FROM members WHERE id = ? AND active = 1").get(id) as Record<string, unknown> | undefined;
  return row ? mapMember(db, row) : null;
}

export function listBootstrap(db: Sqlite, includeArchived = false): { members: Member[]; ventures: Venture[]; projects: Project[] } {
  const clause = includeArchived ? "" : " WHERE active = 1";
  const memberRows = db.prepare(`SELECT * FROM members${clause} ORDER BY name`).all() as Array<Record<string, unknown>>;
  const ventures = (db.prepare(`SELECT * FROM ventures${clause} ORDER BY name`).all() as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id), name: String(row.name), colour: String(row.colour), active: bool(row.active),
  }));
  const projects = (db.prepare(`SELECT * FROM projects${clause} ORDER BY name`).all() as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id), ventureId: Number(row.venture_id), name: String(row.name), colour: String(row.colour), active: bool(row.active),
  }));
  return { members: memberRows.map((row) => mapMember(db, row)), ventures, projects };
}

function mapEntry(row: Record<string, unknown>): DisplayEntry {
  return {
    id: Number(row.id), memberId: Number(row.member_id), seriesId: row.series_id == null ? null : Number(row.series_id),
    projectId: row.project_id == null ? null : Number(row.project_id), status: row.status as CalendarStatus,
    note: row.note == null ? null : String(row.note), leaveCertainty: row.leave_certainty as LeaveCertainty | null,
    startsAtUtc: String(row.starts_at_utc), endsAtUtc: String(row.ends_at_utc), originalDate: String(row.original_date),
    memberName: String(row.member_name), memberTimezone: String(row.member_timezone),
    projectName: row.project_name == null ? null : String(row.project_name),
    projectColour: row.project_colour == null ? null : String(row.project_colour),
    ventureName: row.venture_name == null ? null : String(row.venture_name),
  };
}

const ENTRY_SELECT = `SELECT e.*, m.name member_name, m.timezone member_timezone,
  p.name project_name, p.colour project_colour, v.name venture_name
  FROM calendar_entries e JOIN members m ON m.id=e.member_id
  LEFT JOIN projects p ON p.id=e.project_id LEFT JOIN ventures v ON v.id=p.venture_id`;

export function listEntries(db: Sqlite, fromUtc: string, toUtc: string, memberIds: number[] = []): DisplayEntry[] {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 366 * 86_400_000) throw new Error("Date range must be between 1 and 366 days");
  const memberClause = memberIds.length ? ` AND e.member_id IN (${memberIds.map(() => "?").join(",")})` : "";
  const rows = db.prepare(`${ENTRY_SELECT} WHERE e.ends_at_utc > ? AND e.starts_at_utc < ?${memberClause} ORDER BY e.starts_at_utc`)
    .all(fromUtc, toUtc, ...memberIds) as Array<Record<string, unknown>>;
  return rows.map(mapEntry);
}

export function createEntries(db: Sqlite, memberId: number, input: EntryInput): DisplayEntry[] {
  const occurrences = expandRecurrence(input);
  if (!occurrences.length) throw new Error("No occurrences fall in this recurrence");
  return db.transaction(() => {
    const series = db.prepare(`INSERT INTO calendar_series
      (member_id, project_id, status, note, leave_certainty, timezone, local_start_time, local_end_time, recurrence_rule, recurrence_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(memberId, input.projectId, input.status, input.note, input.leaveCertainty, input.timezone, input.startTime, input.endTime,
        input.recurrence ? JSON.stringify(input.recurrence) : null, input.recurrence?.until ?? null);
    const seriesId = Number(series.lastInsertRowid);
    const insert = db.prepare(`INSERT INTO calendar_entries
      (member_id, series_id, project_id, status, note, leave_certainty, starts_at_utc, ends_at_utc, original_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const ids: number[] = [];
    for (const occurrence of occurrences) {
      const result = insert.run(memberId, seriesId, input.projectId, input.status, input.note, input.leaveCertainty,
        occurrence.startsAtUtc, occurrence.endsAtUtc, occurrence.originalDate);
      ids.push(Number(result.lastInsertRowid));
    }
    return ids.map((id) => mapEntry(db.prepare(`${ENTRY_SELECT} WHERE e.id=?`).get(id) as Record<string, unknown>));
  })();
}

export function updateOwnedEntry(db: Sqlite, memberId: number, entryId: number, patch: Partial<Pick<EntryInput, "status" | "projectId" | "note" | "leaveCertainty">>): DisplayEntry {
  const existing = db.prepare("SELECT id FROM calendar_entries WHERE id=? AND member_id=?").get(entryId, memberId);
  if (!existing) throw new Error("Entry not found");
  const fields: string[] = [];
  const values: unknown[] = [];
  const names: Record<string, string> = { status: "status", projectId: "project_id", note: "note", leaveCertainty: "leave_certainty" };
  for (const [key, column] of Object.entries(names)) {
    if (key in patch) { fields.push(`${column}=?`); values.push(patch[key as keyof typeof patch]); }
  }
  if (fields.length) db.prepare(`UPDATE calendar_entries SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND member_id=?`).run(...values, entryId, memberId);
  return mapEntry(db.prepare(`${ENTRY_SELECT} WHERE e.id=?`).get(entryId) as Record<string, unknown>);
}

export function deleteOwnedEntry(db: Sqlite, memberId: number, entryId: number): boolean {
  return db.prepare("DELETE FROM calendar_entries WHERE id=? AND member_id=?").run(entryId, memberId).changes > 0;
}

export function archiveReference(db: Sqlite, type: "member" | "project" | "venture", id: number): boolean {
  const table = type === "member" ? "members" : type === "project" ? "projects" : "ventures";
  return db.transaction(() => {
    const changed = db.prepare(`UPDATE ${table} SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id).changes > 0;
    if (changed && type === "venture") {
      db.prepare("UPDATE projects SET active=0, updated_at=CURRENT_TIMESTAMP WHERE venture_id=?").run(id);
    }
    return changed;
  })();
}
