import postgres, { type Sql } from "postgres";
import { config } from "../config.js";

// Phase 18b: one postgres.js connection pool shared across all db/* modules.
// Lazy init so unit tests that don't touch the DB never open a connection.
// The backend runs inside docker-compose — the default DATABASE_URL points at
// the host-run Supabase Postgres via host.docker.internal:54322.

let pool: Sql | null = null;

export function db(): Sql {
  if (pool) return pool;
  const url = config.databaseUrl;
  if (!url) {
    throw new Error(
      "[db] DATABASE_URL is not set; assertConfigValid() should have caught " +
        "this at boot. Check your env file.",
    );
  }
  pool = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    // Let application errors bubble as postgres.PostgresError so route
    // handlers can translate them to HTTP codes (unique_violation → 409, etc).
    onnotice: () => {},
  });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (!pool) return;
  await pool.end({ timeout: 5 });
  pool = null;
}

// Test-only: lets specs reset the pool between runs.
export function __resetDbForTests(): void {
  pool = null;
}
