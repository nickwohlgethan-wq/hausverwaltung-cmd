import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client, type QueryResult } from 'pg';

/**
 * Test-Infrastruktur für die Datenbank-Regeln.
 * Erwartet ein laufendes Postgres (>= 15) unter TEST_DATABASE_URL, z. B.
 *   postgres://postgres:postgres@127.0.0.1:5432/postgres
 * Pro Testlauf wird eine eigene Datenbank angelegt und danach wieder gelöscht.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Minimaler Nachbau dessen, was Supabase bereitstellt: Rollen, auth.users, auth.uid()
// und die Standard-Rechte, die Supabase neuen Tabellen an anon/authenticated gibt.
const SUPABASE_STUB = `
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  exception when duplicate_object then null;
  end $$;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  grant usage on schema public to anon, authenticated;
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
`;

export type Db = {
  /** Superuser-Verbindung (umgeht RLS) – für Vorbereitung und Kontrollabfragen */
  admin: Client;
  /** Führt SQL als angemeldeter Nutzer aus (Rolle `authenticated`, JWT-Claim `sub`). */
  as: (userId: string, sql: string, params?: unknown[]) => Promise<QueryResult>;
  /** Führt SQL als nicht angemeldeter Aufrufer aus (Rolle `anon`). */
  anon: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  createUser: (meta: Record<string, unknown>, email?: string) => Promise<string>;
  drop: () => Promise<void>;
};

// Eine Verbindung führt nur eine Transaktion zugleich aus: parallele Aufrufe (z. B. fetchAll) würden
// sonst ihre begin/set role/commit-Befehle ineinander schieben und Rollen und Claims vermischen.
const locks = new WeakMap<Client, Promise<unknown>>();

function inTransaction(
  client: Client,
  role: string,
  claims: string | null,
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  const previous = locks.get(client) ?? Promise.resolve();
  const run = previous.then(
    () => runInTransaction(client, role, claims, sql, params),
    () => runInTransaction(client, role, claims, sql, params),
  );
  locks.set(client, run.catch(() => undefined));
  return run;
}

async function runInTransaction(
  client: Client,
  role: string,
  claims: string | null,
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    if (claims) await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

export async function createTestDb(): Promise<Db> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL ist nicht gesetzt');
  const name = `hv_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const root = new Client({ connectionString: TEST_DATABASE_URL });
  await root.connect();
  await root.query(`create database ${name}`);
  await root.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();

  await admin.query(SUPABASE_STUB);
  // MIGRATIONS_DIR nur für Mutationstests (absichtlich abgeschwächte Migration)
  const dir = process.env.MIGRATIONS_DIR ?? join(__dirname, '..', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await admin.query(readFileSync(join(dir, file), 'utf8'));
  }

  return {
    admin,
    as: (userId, sql, params) =>
      inTransaction(admin, 'authenticated', JSON.stringify({ sub: userId, role: 'authenticated' }), sql, params),
    anon: (sql, params) => inTransaction(admin, 'anon', null, sql, params),
    async createUser(meta, email) {
      const id = randomUUID();
      await admin.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
        id,
        email ?? `${id}@example.com`,
        JSON.stringify(meta),
      ]);
      return id;
    },
    async drop() {
      await admin.end();
      const cleanup = new Client({ connectionString: TEST_DATABASE_URL });
      await cleanup.connect();
      await cleanup.query(`drop database ${name} with (force)`);
      await cleanup.end();
    },
  };
}
