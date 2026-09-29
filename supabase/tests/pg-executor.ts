import { BackendError } from '../../src/lib/errors';
import type { Executor, Row } from '../../src/lib/repo';
import type { Db } from './db-helpers';

const TABLES = new Set([
  'properties', 'units', 'tenants', 'payments', 'costs', 'tickets', 'ticket_comments',
]);
const FUNCTIONS = new Set(['property_totals']);
const ident = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error(`Ungültiger Bezeichner: ${s}`);
  return `"${s}"`;
};

/**
 * Executor, der wie die App über die Zugriffsregeln (Rolle `authenticated`, Nutzer `userId`)
 * direkt auf Postgres arbeitet. Zeilen kommen als JSON zurück – im Format, das PostgREST liefert
 * (Datum/Zeit als Text, numeric als Zahl).
 */
export function pgExecutor(db: Db, userId: string): Executor {
  const need = (table: string) => {
    if (!TABLES.has(table)) throw new Error(`Unbekannte Tabelle: ${table}`);
    return ident(table);
  };
  return {
    async select(table) {
      const r = await db.as(userId, `select to_jsonb(t) as j from ${need(table)} t order by id`);
      return r.rows.map((x) => x.j as Row);
    },
    async insert(table, row) {
      const cols = Object.keys(row);
      const params = cols.map((_, i) => `$${i + 1}`).join(', ');
      await db.as(userId, `insert into ${need(table)} (${cols.map(ident).join(', ')}) values (${params})`, Object.values(row));
    },
    async update(table, id, patch) {
      const cols = Object.keys(patch);
      const sets = cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ');
      const r = await db.as(userId, `update ${need(table)} set ${sets} where id = $${cols.length + 1} returning id`, [...Object.values(patch), id]);
      if (r.rowCount === 0) throw new BackendError('not_found', `${table}/${id}`);
    },
    async remove(table, id) {
      const r = await db.as(userId, `delete from ${need(table)} where id = $1 returning id`, [id]);
      if (r.rowCount === 0) throw new BackendError('not_found', `${table}/${id}`);
    },
    async rpc(fn) {
      if (!FUNCTIONS.has(fn)) throw new Error(`Unbekannte Funktion: ${fn}`);
      const r = await db.as(userId, `select to_jsonb(f) as j from ${ident(fn)}() f`);
      return r.rows.map((x) => x.j as Row);
    },
  };
}
