import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { runSeed } from "../src/lib/seed";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const db = drizzle(pool, { schema });

runSeed(db)
  .then(async () => {
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
