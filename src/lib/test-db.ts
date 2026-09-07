import { newDb } from "pg-mem";
import { migrate, type DbPool } from "./db";

export async function createTestDb(): Promise<DbPool> {
  const memory = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool() as unknown as DbPool;
  await migrate(pool);
  return pool;
}
