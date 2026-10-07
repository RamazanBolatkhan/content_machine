import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");

type DB = BetterSQLite3Database<typeof schema>;

// Reuse one connection across hot reloads in dev
const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const sqlite = new Database(path.join(DATA_DIR, "app.db"), { timeout: 10_000 });
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing().run();
  return db;
}

function getDb(): DB {
  return (globalForDb.__db ??= createDb());
}

// Opened on first use, not at import (build workers import pages in parallel)
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
