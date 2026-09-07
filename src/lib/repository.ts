import { DateTime } from "luxon";
import type { PoolClient, QueryResultRow } from "pg";
import type { DbPool, DbQueryable } from "./db";
import type { CalendarEntry, CalendarStatus, LeaveCertainty, Member, Project, Venture } from "./domain";
import { expandRecurrence, type RecurrenceRule } from "./recurrence";

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

function timestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toISOString();
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function withTransaction<T>(db: DbPool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function assertAssociationsExist(client: DbQueryable, input: MemberInput): Promise<void> {
  if (input.ventureIds.length) {
    const placeholders = input.ventureIds.map((_, index) => `$${index + 1}`).join(",");
    const result = await client.query(`SELECT id FROM ventures WHERE id IN (${placeholders})`, input.ventureIds);
    if (result.rowCount !== new Set(input.ventureIds).size) throw new Error("Venture association is invalid");
  }
  if (input.projectIds.length) {
    const placeholders = input.projectIds.map((_, index) => `$${index + 1}`).join(",");
    const result = await client.query(`SELECT id FROM projects WHERE id IN (${placeholders})`, input.projectIds);
    if (result.rowCount !== new Set(input.projectIds).size) throw new Error("Project association is invalid");
  }
}

async function mapMember(db: DbQueryable, row: QueryResultRow): Promise<Member> {
  const [ventures, projects] = await Promise.all([
    db.query<{ id: number }>("SELECT venture_id AS id FROM member_ventures WHERE member_id = $1", [row.id]),
    db.query<{ id: number }>("SELECT project_id AS id FROM member_projects WHERE member_id = $1", [row.id]),
  ]);
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    location: String(row.location),
    timezone: String(row.timezone),
    weeklyRequirementStart: dateOnly(row.weekly_requirement_start),
    active: Boolean(row.active),
    ventureIds: ventures.rows.map((item) => Number(item.id)),
    projectIds: projects.rows.map((item) => Number(item.id)),
  };
}

export async function createVenture(db: DbQueryable, input: { name: string; colour: string }): Promise<Venture> {
  const name = input.name.trim();
  const result = await db.query<{ id: number }>(
    "INSERT INTO ventures(name, colour) VALUES ($1, $2) RETURNING id",
    [name, input.colour],
  );
  return { id: Number(result.rows[0].id), name, colour: input.colour, active: true };
}

export async function createProject(db: DbQueryable, input: { ventureId: number; name: string; colour: string }): Promise<Project> {
  const name = input.name.trim();
  const result = await db.query<{ id: number }>(
    "INSERT INTO projects(venture_id, name, colour) VALUES ($1, $2, $3) RETURNING id",
    [input.ventureId, name, input.colour],
  );
  return { id: Number(result.rows[0].id), ventureId: input.ventureId, name, colour: input.colour, active: true };
}

export async function createMember(db: DbPool, input: MemberInput): Promise<Member> {
  return withTransaction(db, async (client) => {
    await assertAssociationsExist(client, input);
    const createdDate = DateTime.now().setZone(input.timezone).startOf("day");
    const weeklyRequirementStart = createdDate.plus({ days: (8 - createdDate.weekday) % 7 }).toISODate()!;
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const location = input.location.trim();
    const result = await client.query<{ id: number }>(
      `INSERT INTO members(name, email, location, timezone, weekly_requirement_start)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, email, location, input.timezone, weeklyRequirementStart],
    );
    const id = Number(result.rows[0].id);
    for (const ventureId of input.ventureIds) {
      await client.query("INSERT INTO member_ventures(member_id, venture_id) VALUES ($1, $2)", [id, ventureId]);
    }
    for (const projectId of input.projectIds) {
      await client.query("INSERT INTO member_projects(member_id, project_id) VALUES ($1, $2)", [id, projectId]);
    }
    return {
      id,
      name,
      email,
      location,
      timezone: input.timezone,
      weeklyRequirementStart,
      ventureIds: [...input.ventureIds],
      projectIds: [...input.projectIds],
      active: true,
    };
  });
}

export async function updateMember(db: DbPool, id: number, input: MemberInput & { active?: boolean }): Promise<Member> {
  return withTransaction(db, async (client) => {
    await assertAssociationsExist(client, input);
    const result = await client.query(
      `UPDATE members SET name=$1, email=$2, location=$3, timezone=$4, active=$5, updated_at=CURRENT_TIMESTAMP
       WHERE id=$6`,
      [input.name.trim(), input.email.trim().toLowerCase(), input.location.trim(), input.timezone, input.active !== false, id],
    );
    if (!result.rowCount) throw new Error("Member not found");
    await client.query("DELETE FROM member_ventures WHERE member_id=$1", [id]);
    await client.query("DELETE FROM member_projects WHERE member_id=$1", [id]);
    for (const ventureId of input.ventureIds) {
      await client.query("INSERT INTO member_ventures(member_id, venture_id) VALUES ($1, $2)", [id, ventureId]);
    }
    for (const projectId of input.projectIds) {
      await client.query("INSERT INTO member_projects(member_id, project_id) VALUES ($1, $2)", [id, projectId]);
    }
    const member = await findMemberById(client, id, true);
    if (!member) throw new Error("Member not found");
    return member;
  });
}

export async function findMemberByEmail(db: DbQueryable, email: string): Promise<Member | null> {
  const result = await db.query("SELECT * FROM members WHERE LOWER(email) = LOWER($1) AND active = TRUE", [email.trim()]);
  return result.rows[0] ? mapMember(db, result.rows[0]) : null;
}

export async function findMemberById(db: DbQueryable, id: number, includeArchived = false): Promise<Member | null> {
  const activeClause = includeArchived ? "" : " AND active = TRUE";
  const result = await db.query(`SELECT * FROM members WHERE id = $1${activeClause}`, [id]);
  return result.rows[0] ? mapMember(db, result.rows[0]) : null;
}

export async function listBootstrap(db: DbQueryable, includeArchived = false): Promise<{ members: Member[]; ventures: Venture[]; projects: Project[] }> {
  const clause = includeArchived ? "" : " WHERE active = TRUE";
  const [memberRows, ventureRows, projectRows] = await Promise.all([
    db.query(`SELECT * FROM members${clause} ORDER BY name`),
    db.query(`SELECT * FROM ventures${clause} ORDER BY name`),
    db.query(`SELECT * FROM projects${clause} ORDER BY name`),
  ]);
  const members = await Promise.all(memberRows.rows.map((row) => mapMember(db, row)));
  const ventures = ventureRows.rows.map((row) => ({
    id: Number(row.id), name: String(row.name), colour: String(row.colour), active: Boolean(row.active),
  }));
  const projects = projectRows.rows.map((row) => ({
    id: Number(row.id), ventureId: Number(row.venture_id), name: String(row.name), colour: String(row.colour), active: Boolean(row.active),
  }));
  return { members, ventures, projects };
}

function mapEntry(row: QueryResultRow): DisplayEntry {
  return {
    id: Number(row.id),
    memberId: Number(row.member_id),
    seriesId: row.series_id == null ? null : Number(row.series_id),
    projectId: row.project_id == null ? null : Number(row.project_id),
    status: row.status as CalendarStatus,
    note: row.note == null ? null : String(row.note),
    leaveCertainty: row.leave_certainty as LeaveCertainty | null,
    startsAtUtc: timestamp(row.starts_at_utc),
    endsAtUtc: timestamp(row.ends_at_utc),
    originalDate: dateOnly(row.original_date),
    memberName: String(row.member_name),
    memberTimezone: String(row.member_timezone),
    projectName: row.project_name == null ? null : String(row.project_name),
    projectColour: row.project_colour == null ? null : String(row.project_colour),
    ventureName: row.venture_name == null ? null : String(row.venture_name),
  };
}

const ENTRY_SELECT = `SELECT e.*, m.name AS member_name, m.timezone AS member_timezone,
  p.name AS project_name, p.colour AS project_colour, v.name AS venture_name
  FROM calendar_entries e JOIN members m ON m.id=e.member_id
  LEFT JOIN projects p ON p.id=e.project_id LEFT JOIN ventures v ON v.id=p.venture_id`;

export async function listEntries(db: DbQueryable, fromUtc: string, toUtc: string, memberIds: number[] = []): Promise<DisplayEntry[]> {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 366 * 86_400_000) {
    throw new Error("Date range must be between 1 and 366 days");
  }
  const memberClause = memberIds.length
    ? ` AND e.member_id IN (${memberIds.map((_, index) => `$${index + 3}`).join(",")})`
    : "";
  const values: unknown[] = [fromUtc, toUtc, ...memberIds];
  const result = await db.query(
    `${ENTRY_SELECT} WHERE e.ends_at_utc > $1 AND e.starts_at_utc < $2${memberClause} ORDER BY e.starts_at_utc`,
    values,
  );
  return result.rows.map(mapEntry);
}

export async function createEntries(db: DbPool, memberId: number, input: EntryInput): Promise<DisplayEntry[]> {
  const occurrences = expandRecurrence(input);
  if (!occurrences.length) throw new Error("No occurrences fall in this recurrence");
  return withTransaction(db, async (client) => {
    const series = await client.query<{ id: number }>(
      `INSERT INTO calendar_series
       (member_id, project_id, status, note, leave_certainty, timezone, local_start_time, local_end_time, recurrence_rule, recurrence_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [memberId, input.projectId, input.status, input.note, input.leaveCertainty, input.timezone, input.startTime,
        input.endTime, input.recurrence ? JSON.stringify(input.recurrence) : null, input.recurrence?.until ?? null],
    );
    const seriesId = Number(series.rows[0].id);
    const ids: number[] = [];
    for (const occurrence of occurrences) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO calendar_entries
         (member_id, series_id, project_id, status, note, leave_certainty, starts_at_utc, ends_at_utc, original_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [memberId, seriesId, input.projectId, input.status, input.note, input.leaveCertainty,
          occurrence.startsAtUtc, occurrence.endsAtUtc, occurrence.originalDate],
      );
      ids.push(Number(result.rows[0].id));
    }
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(",");
    const created = await client.query(`${ENTRY_SELECT} WHERE e.id IN (${placeholders}) ORDER BY e.starts_at_utc`, ids);
    return created.rows.map(mapEntry);
  });
}

export async function updateOwnedEntry(
  db: DbQueryable,
  memberId: number,
  entryId: number,
  patch: Partial<Pick<EntryInput, "status" | "projectId" | "note" | "leaveCertainty">>,
): Promise<DisplayEntry> {
  const names = { status: "status", projectId: "project_id", note: "note", leaveCertainty: "leave_certainty" } as const;
  const values: unknown[] = [];
  const fields: string[] = [];
  for (const [key, column] of Object.entries(names)) {
    if (key in patch) {
      values.push(patch[key as keyof typeof patch]);
      fields.push(`${column}=$${values.length}`);
    }
  }
  if (fields.length) {
    values.push(entryId, memberId);
    const result = await db.query(
      `UPDATE calendar_entries SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP
       WHERE id=$${values.length - 1} AND member_id=$${values.length}`,
      values,
    );
    if (!result.rowCount) throw new Error("Entry not found");
  } else {
    const existing = await db.query("SELECT id FROM calendar_entries WHERE id=$1 AND member_id=$2", [entryId, memberId]);
    if (!existing.rowCount) throw new Error("Entry not found");
  }
  const entry = await db.query(`${ENTRY_SELECT} WHERE e.id=$1`, [entryId]);
  if (!entry.rows[0]) throw new Error("Entry not found");
  return mapEntry(entry.rows[0]);
}

export async function deleteOwnedEntry(db: DbQueryable, memberId: number, entryId: number): Promise<boolean> {
  const result = await db.query("DELETE FROM calendar_entries WHERE id=$1 AND member_id=$2", [entryId, memberId]);
  return Boolean(result.rowCount);
}

export async function archiveReference(db: DbPool, type: "member" | "project" | "venture", id: number): Promise<boolean> {
  const table = type === "member" ? "members" : type === "project" ? "projects" : "ventures";
  return withTransaction(db, async (client) => {
    const result = await client.query(
      `UPDATE ${table} SET active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [id],
    );
    const changed = Boolean(result.rowCount);
    if (changed && type === "venture") {
      await client.query("UPDATE projects SET active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE venture_id=$1", [id]);
    }
    return changed;
  });
}
