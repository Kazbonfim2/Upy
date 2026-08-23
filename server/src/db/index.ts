import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");

export const sql = postgres(url);
export const db = drizzle(sql, { schema });

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      id serial PRIMARY KEY,
      name text NOT NULL,
      url text NOT NULL,
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
      checked_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id serial PRIMARY KEY,
      monitor_id integer NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz,
      last_error text
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
  await sql`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS body text`;
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'`;
  await sql`CREATE INDEX IF NOT EXISTS checks_monitor_checked_idx ON checks (monitor_id, checked_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS incidents_monitor_open_idx ON incidents (monitor_id) WHERE ended_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS cards_monitor_idx ON cards (monitor_id)`;
}
