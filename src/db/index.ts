import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

// One pool per process; reused across hot reloads in dev.
// The pool only connects on the first query, so importing this at build time is safe.
const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return drizzle(pool, { schema });
}

export const db: DB = globalForDb.__db ?? (globalForDb.__db = createDb());
export { schema };
