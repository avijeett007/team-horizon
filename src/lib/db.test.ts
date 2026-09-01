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
  });
});
