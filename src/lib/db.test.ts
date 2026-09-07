import { afterEach, describe, expect, it } from "vitest";
import { databaseSchema, getDb, migrate } from "./db";
import { createTestDb } from "./test-db";

describe("PostgreSQL database migration", () => {
  it("creates the complete calendar schema idempotently", async () => {
    const db = await createTestDb();

    try {
      await migrate(db);
      await migrate(db);

      const versions = await db.query<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version",
      );
      expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);

      const tables = await db.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual(
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

      const columns = await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'members'",
      );
      expect(columns.rows.map((row) => row.column_name)).toContain("weekly_requirement_start");
    } finally {
      await db.end();
    }
  });

  it("rejects unsafe PostgreSQL schema names", () => {
    expect(() => databaseSchema("public-invalid!")).toThrow("DATABASE_SCHEMA");
    expect(databaseSchema("team_horizon_e2e_123")).toBe("team_horizon_e2e_123");
  });
});

describe("PostgreSQL connection configuration", () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  it("fails safely when DATABASE_URL is not configured", async () => {
    delete process.env.DATABASE_URL;
    await expect(getDb()).rejects.toThrow("DATABASE_URL is required");
  });
});
