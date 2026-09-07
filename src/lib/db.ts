import { DateTime } from "luxon";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { POSTGRES_REQUIREMENT_MIGRATION_SQL, POSTGRES_SCHEMA_SQL } from "./schema";

export interface DbQueryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface DbPool extends DbQueryable {
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

declare global {
  var __teamHorizonDb: Pool | undefined;
  var __teamHorizonDbReady: Promise<void> | undefined;
}

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function databaseSchema(value = process.env.DATABASE_SCHEMA ?? "team_horizon"): string {
  if (!SCHEMA_PATTERN.test(value)) {
    throw new Error("DATABASE_SCHEMA must contain only lowercase letters, numbers, and underscores");
  }
  return value;
}

export async function migrate(db: DbQueryable): Promise<void> {
  await db.query(POSTGRES_SCHEMA_SQL);
  await db.query(
    "INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT (version) DO NOTHING",
  );
  await db.query(POSTGRES_REQUIREMENT_MIGRATION_SQL);

  const today = DateTime.utc().startOf("day");
  const nextMonday = today.plus({ days: 8 - today.weekday }).toISODate();
  await db.query(
    "UPDATE members SET weekly_requirement_start = $1 WHERE weekly_requirement_start IS NULL",
    [nextMonday],
  );
  await db.query(
    "INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT (version) DO NOTHING",
  );
}

async function initializeDatabase(pool: Pool, connectionString: string, schema: string): Promise<void> {
  const bootstrap = new Pool({ connectionString });
  try {
    await bootstrap.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await bootstrap.end();
  }
  await migrate(pool);
}

export async function getDb(): Promise<DbPool> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  if (!globalThis.__teamHorizonDb) {
    const schema = databaseSchema();
    const pool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
    });
    globalThis.__teamHorizonDb = pool;
    globalThis.__teamHorizonDbReady = initializeDatabase(pool, connectionString, schema).catch(
      async (error) => {
        globalThis.__teamHorizonDb = undefined;
        globalThis.__teamHorizonDbReady = undefined;
        await pool.end().catch(() => undefined);
        throw error;
      },
    );
  }

  await globalThis.__teamHorizonDbReady;
  return globalThis.__teamHorizonDb;
}
