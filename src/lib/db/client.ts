import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/prism";

const pool = postgres(DATABASE_URL, {
  max: 10,
});

export const db = drizzle(pool);

export function createDrizzleClient(databaseUrl: string = DATABASE_URL) {
  const testPool = postgres(databaseUrl, { max: 5 });
  return drizzle(testPool, { schema: {} });
}

export async function closeDb() {
  await pool.end();
}
