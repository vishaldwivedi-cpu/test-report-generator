import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

// Managed providers (Neon, Supabase, RDS, etc.) require TLS but typically use
// certs that aren't in Node's default trust store. `sslmode=require` in the
// connection string signals we should connect over TLS without verifying the
// chain — fine for these providers, and a no-op for a local/unencrypted DB.
const needsSsl = /sslmode=require/i.test(databaseUrl) || Boolean(process.env.VERCEL);

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
