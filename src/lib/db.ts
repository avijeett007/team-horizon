import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

type Sqlite = Database.Database;

declare global {
  var __teamCalendarDb: Sqlite | undefined;
}

export function migrate(db: Sqlite): void {
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)").run();
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
