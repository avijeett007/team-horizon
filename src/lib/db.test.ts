import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "./db";

describe("database migration", () => {
  it("creates the complete calendar schema idempotently", () => {
    const db = new Database(":memory:");
    migrate(db);
    migrate(db);

    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "ventures",
        "projects",
        "members",
        "member_ventures",
        "member_projects",
        "calendar_series",
        "calendar_entries",
        "series_exceptions",
      ]),
    );
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);

    const memberColumns = db.pragma("table_info(members)") as Array<{ name: string }>;
    expect(memberColumns.map((column) => column.name)).toContain("weekly_requirement_start");
    expect((db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>).map((row) => row.version)).toEqual([1, 2]);
  });

  it("upgrades an existing version-one members table without losing people", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO schema_migrations(version) VALUES (1);
      CREATE TABLE members (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        location TEXT NOT NULL, timezone TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO members(name,email,location,timezone) VALUES ('Asha','asha@example.com','London','Europe/London');
    `);

    migrate(db);

    const row = db.prepare("SELECT weekly_requirement_start start FROM members WHERE email=?").get("asha@example.com") as { start: string };
    expect(row.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${row.start}T12:00:00Z`).getUTCDay()).toBe(1);
  });
});
