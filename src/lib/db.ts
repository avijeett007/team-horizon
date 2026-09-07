import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { SCHEMA_SQL } from "./schema";

type Sqlite = Database.Database;

declare global {
  var __teamCalendarDb: Sqlite | undefined;
}

export function migrate(db: Sqlite): void {
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)").run();
  const hasVersionTwo = Boolean(db.prepare("SELECT 1 FROM schema_migrations WHERE version=2").get());
  if (!hasVersionTwo) {
    const columns = db.pragma("table_info(members)") as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "weekly_requirement_start")) {
      db.exec("ALTER TABLE members ADD COLUMN weekly_requirement_start TEXT");
    }
    const today = DateTime.utc().startOf("day");
    const nextMonday = today.plus({ days: 8 - today.weekday }).toISODate();
    db.prepare("UPDATE members SET weekly_requirement_start=? WHERE weekly_requirement_start IS NULL").run(nextMonday);
    db.prepare("INSERT INTO schema_migrations(version) VALUES (2)").run();
  }
}

export function getDb(): Sqlite {
  if (globalThis.__teamCalendarDb) return globalThis.__teamCalendarDb;

  const databasePath = process.env.DATABASE_PATH ?? "./data/team-calendar.db";
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  globalThis.__teamCalendarDb = db;
  return db;
}
