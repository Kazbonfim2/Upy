import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "postgres://upy:upy@127.0.0.1:5432/upy";

export const sql = postgres(url, {
  max: Number(process.env.DB_POOL_MAX || 25),
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(sql, { schema });

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id serial PRIMARY KEY,
      name text NOT NULL,
      base_url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      id serial PRIMARY KEY,
      service_id integer REFERENCES services(id) ON DELETE CASCADE,
      name text NOT NULL,
      path text NOT NULL DEFAULT '/',
      url text,
      method text NOT NULL DEFAULT 'GET',
      interval_seconds integer NOT NULL DEFAULT 60,
      timeout_ms integer NOT NULL DEFAULT 5000,
      expected_status integer NOT NULL DEFAULT 200,
      body text,
      enabled boolean NOT NULL DEFAULT true,
      last_ok boolean,
      last_status_code integer,
      last_latency_ms integer,
      last_error text,
      last_checked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS checks (
      id serial PRIMARY KEY,
      monitor_id integer NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      ok boolean NOT NULL,
      status_code integer,
      latency_ms integer NOT NULL,
      error text,
      response_body text,
      checked_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id serial PRIMARY KEY,
      monitor_id integer NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz,
      last_error text,
      response_body text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS alerts (
      id serial PRIMARY KEY,
      monitor_id integer NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      channel text NOT NULL,
      target text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id serial PRIMARY KEY,
      monitor_id integer NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      name text NOT NULL,
      status text NOT NULL,
      description text NOT NULL DEFAULT '',
      resolved boolean NOT NULL DEFAULT false,
      source text NOT NULL DEFAULT 'manual',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS service_id integer REFERENCES services(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS path text DEFAULT '/'`;
  await sql`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS body text`;
  await sql`ALTER TABLE monitors ALTER COLUMN url DROP NOT NULL`;
  await sql`ALTER TABLE monitors ALTER COLUMN url SET DEFAULT ''`;
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'`;
  await sql`ALTER TABLE checks ADD COLUMN IF NOT EXISTS response_body text`;
  await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_body text`;
  await sql`CREATE INDEX IF NOT EXISTS checks_monitor_checked_idx ON checks (monitor_id, checked_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS checks_checked_at_idx ON checks (checked_at)`;
  await sql`CREATE INDEX IF NOT EXISTS incidents_monitor_open_idx ON incidents (monitor_id) WHERE ended_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS cards_monitor_idx ON cards (monitor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS monitors_service_idx ON monitors (service_id)`;
  await sql`CREATE INDEX IF NOT EXISTS monitors_due_idx ON monitors (enabled, last_checked_at) WHERE enabled = true`;
  await sql`CREATE INDEX IF NOT EXISTS alerts_monitor_idx ON alerts (monitor_id)`;

  // Migrar monitores existentes que não possuem service_id vinculado
  const unlinked = await sql`SELECT id, name, url FROM monitors WHERE service_id IS NULL`;
  for (const m of unlinked) {
    if (!m.url) continue;
    try {
      const parsed = new URL(m.url);
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      const path = (parsed.pathname || "/") + (parsed.search || "") + (parsed.hash || "");
      const [svc] = await sql`
        INSERT INTO services (name, base_url)
        VALUES (${m.name || 'Serviço'}, ${baseUrl})
        RETURNING id
      `;
      await sql`
        UPDATE monitors
        SET service_id = ${svc.id}, path = ${path}
        WHERE id = ${m.id}
      `;
    } catch {
      const [svc] = await sql`
        INSERT INTO services (name, base_url)
        VALUES (${m.name || 'Serviço'}, 'http://localhost')
        RETURNING id
      `;
      await sql`
        UPDATE monitors
        SET service_id = ${svc.id}, path = '/'
        WHERE id = ${m.id}
      `;
    }
  }
}
