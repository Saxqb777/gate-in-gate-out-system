import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type AppDb = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { pgPool?: Pool; drizzleDb?: AppDb };

function getDb(): AppDb {
  if (!globalForDb.drizzleDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.pgPool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    globalForDb.drizzleDb = drizzle(globalForDb.pgPool, { schema });
  }
  return globalForDb.drizzleDb;
}

/**
 * Lazily created database client. Nothing connects until the first query, so
 * `next build` succeeds without DATABASE_URL and the pool is shared per process.
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Db = AppDb;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
