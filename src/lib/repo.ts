import type {
  CostItem,
  Db,
  Payment,
  Property,
  Tenant,
  Ticket,
  TicketComment,
  Unit,
} from './types';
import { EMPTY_DB } from './types';

/**
 * Übersetzt zwischen dem App-Modell (`Db`) und den Tabellenzeilen im Backend und leitet aus
 * Änderungen am App-Modell die nötigen Schreibvorgänge ab („Diff“). Die Spaltenlisten entsprechen
 * exakt den GRANTs in supabase/migrations – andere Spalten darf der Client nicht schreiben.
 */

export type Row = Record<string, unknown>;

/** Zugriff auf das Backend; von Supabase und (in Tests) von einer direkten Postgres-Verbindung bedient. */
export interface Executor {
  /** Alle für den Nutzer sichtbaren Zeilen der Tabelle (Sichtbarkeit regelt RLS). */
  select(table: string): Promise<Row[]>;
  insert(table: string, row: Row): Promise<void>;
  /** Wirft, wenn keine Zeile geändert wurde (nicht vorhanden oder nicht erlaubt). */
  update(table: string, id: string, patch: Row): Promise<void>;
  /** Wirft, wenn keine Zeile gelöscht wurde. */
  remove(table: string, id: string): Promise<void>;
  rpc(fn: string): Promise<Row[]>;
}

// ---------------------------------------------------------------------------
// Lesen: Zeilen → App-Modell
// ---------------------------------------------------------------------------

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => Number(v);
const isoDate = (v: unknown) => str(v).slice(0, 10);
const isoTime = (v: unknown) => new Date(str(v)).toISOString();

const toProperty = (r: Row): Property => ({
  id: str(r.id),
  name: str(r.name),
  street: str(r.street),
  zip: str(r.zip),
  city: str(r.city),
});

const toUnit = (r: Row): Unit => ({
  id: str(r.id),
  propertyId: str(r.property_id),
  name: str(r.name),
  floor: str(r.floor),
  areaSqm: num(r.area_sqm),
  rooms: num(r.rooms),
  baseRent: num(r.base_rent),
  utilitiesPrepayment: num(r.utilities_prepayment),
});

const toTenant = (r: Row): Tenant => ({
  id: str(r.id),
  unitId: str(r.unit_id),
  name: str(r.name),
  email: str(r.email),
  phone: str(r.phone),
  moveIn: isoDate(r.move_in),
  inviteCode: r.invite_code == null ? null : str(r.invite_code),
  claimed: r.user_id != null,
});

const toPayment = (r: Row): Payment => ({
  id: str(r.id),
  tenantId: str(r.tenant_id),
  month: str(r.month),
  rentDue: num(r.rent_due),
  utilitiesDue: num(r.utilities_due),
  paid: num(r.paid),
  paidOn: r.paid_on == null ? undefined : isoDate(r.paid_on),
});

const toCost = (r: Row): CostItem => ({
  id: str(r.id),
  propertyId: str(r.property_id),
  year: num(r.year),
  category: str(r.category),
  amount: num(r.amount),
  key: r.key === 'units' ? 'units' : 'area',
});

const toComment = (r: Row): TicketComment => ({
  id: str(r.id),
  authorRole: r.author_role === 'verwalter' ? 'verwalter' : 'mieter',
  authorName: str(r.author_name),
  text: str(r.text),
  at: isoTime(r.created_at),
});

const toTicket = (r: Row, comments: TicketComment[]): Ticket => ({
  id: str(r.id),
  tenantId: str(r.tenant_id),
  unitId: str(r.unit_id),
  title: str(r.title),
  description: str(r.description),
  category: str(r.category),
  priority: r.priority === 'low' || r.priority === 'urgent' ? r.priority : 'normal',
  status: r.status === 'in_progress' || r.status === 'done' ? r.status : 'open',
  createdAt: isoTime(r.created_at),
  comments,
});

/** Lädt alle für den angemeldeten Nutzer sichtbaren Daten (RLS begrenzt sie auf dessen Bereich). */
export async function fetchAll(exec: Executor, role: 'verwalter' | 'mieter'): Promise<Db> {
  const [properties, units, tenants, payments, costs, tickets, comments, totals] = await Promise.all([
    exec.select('properties'),
    exec.select('units'),
    exec.select('tenants'),
    exec.select('payments'),
    exec.select('costs'),
    exec.select('tickets'),
    exec.select('ticket_comments'),
    role === 'mieter' ? exec.rpc('property_totals') : Promise.resolve<Row[]>([]),
  ]);

  const byTicket = new Map<string, TicketComment[]>();
  for (const c of [...comments].sort((a, b) => isoTime(a.created_at).localeCompare(isoTime(b.created_at)))) {
    const list = byTicket.get(str(c.ticket_id)) ?? [];
    list.push(toComment(c));
    byTicket.set(str(c.ticket_id), list);
  }

  const db: Db = {
    ...EMPTY_DB,
    properties: properties.map(toProperty),
    units: units.map(toUnit),
    tenants: tenants.map(toTenant),
    payments: payments.map(toPayment),
    costs: costs.map(toCost),
    tickets: tickets.map((t) => toTicket(t, byTicket.get(str(t.id)) ?? [])),
  };
  if (role === 'mieter') {
    db.totals = Object.fromEntries(
      totals.map((r) => [str(r.property_id), { totalArea: num(r.total_area), unitCount: num(r.unit_count) }]),
    );
  }
  return db;
}

// ---------------------------------------------------------------------------
// Schreiben: Änderungen am App-Modell → Operationen
// ---------------------------------------------------------------------------

export type Op =
  | { kind: 'insert'; table: string; id: string; row: Row }
  | { kind: 'update'; table: string; id: string; patch: Row }
  | { kind: 'delete'; table: string; id: string };

type Spec<T extends { id: string }> = {
  table: string;
  items: (db: Db) => T[];
  /** Spalten beim Anlegen */
  insert: (x: T) => Row;
  /** Nachträglich änderbare Spalten (nur diese werden bei Änderungen gesendet) */
  update: (x: T) => Row;
  deletable?: boolean;
};

const none = () => ({});

const SPECS: Spec<any>[] = [
  {
    table: 'properties',
    items: (db) => db.properties,
    insert: (p: Property) => ({ id: p.id, name: p.name, street: p.street, zip: p.zip, city: p.city }),
    update: (p: Property) => ({ name: p.name, street: p.street, zip: p.zip, city: p.city }),
  } satisfies Spec<Property>,
  {
    table: 'units',
    items: (db) => db.units,
    insert: (u: Unit) => ({
      id: u.id,
      property_id: u.propertyId,
      name: u.name,
      floor: u.floor,
      area_sqm: u.areaSqm,
      rooms: u.rooms,
      base_rent: u.baseRent,
      utilities_prepayment: u.utilitiesPrepayment,
    }),
    update: (u: Unit) => ({
      name: u.name,
      floor: u.floor,
      area_sqm: u.areaSqm,
      rooms: u.rooms,
      base_rent: u.baseRent,
      utilities_prepayment: u.utilitiesPrepayment,
    }),
  } satisfies Spec<Unit>,
  {
    table: 'tenants',
    items: (db) => db.tenants,
    insert: (t: Tenant) => ({
      id: t.id,
      unit_id: t.unitId,
      name: t.name,
      email: t.email,
      phone: t.phone,
      move_in: t.moveIn,
      invite_code: t.inviteCode,
    }),
    update: (t: Tenant) => ({
      name: t.name,
      email: t.email,
      phone: t.phone,
      move_in: t.moveIn,
      invite_code: t.inviteCode,
    }),
  } satisfies Spec<Tenant>,
  {
    table: 'payments',
    items: (db) => db.payments,
    insert: (p: Payment) => ({
      id: p.id,
      tenant_id: p.tenantId,
      month: p.month,
      rent_due: p.rentDue,
      utilities_due: p.utilitiesDue,
    }),
    update: (p: Payment) => ({ paid: p.paid, paid_on: p.paidOn ?? null }),
  } satisfies Spec<Payment>,
  {
    table: 'costs',
    items: (db) => db.costs,
    insert: (c: CostItem) => ({
      id: c.id,
      property_id: c.propertyId,
      year: c.year,
      category: c.category,
      amount: c.amount,
      key: c.key,
    }),
    update: none,
    deletable: true,
  } satisfies Spec<CostItem>,
  {
    table: 'tickets',
    items: (db) => db.tickets,
    insert: (t: Ticket) => ({
      id: t.id,
      tenant_id: t.tenantId,
      unit_id: t.unitId,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
    }),
    update: (t: Ticket) => ({ status: t.status }),
  } satisfies Spec<Ticket>,
];

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

/**
 * Ermittelt die Schreibvorgänge, die `prev` in `next` überführen.
 * Reihenfolge: erst Anlegen (Eltern vor Kindern), dann Ändern, dann Löschen.
 * Änderungen senden nur die tatsächlich geänderten Spalten – so überschreibt die App keine Werte,
 * die ein anderes Gerät inzwischen geändert hat (z. B. den Einlösestatus eines Einladungscodes).
 */
export function diffDb(prev: Db, next: Db): Op[] {
  const inserts: Op[] = [];
  const updates: Op[] = [];
  const deletes: Op[] = [];

  for (const spec of SPECS) {
    const before = byId<{ id: string }>(spec.items(prev));
    const after = byId<{ id: string }>(spec.items(next));
    for (const [id, item] of after) {
      const old = before.get(id);
      if (!old) {
        inserts.push({ kind: 'insert', table: spec.table, id, row: spec.insert(item) });
        continue;
      }
      const oldCols = spec.update(old);
      const newCols = spec.update(item);
      const patch: Row = {};
      for (const key of Object.keys(newCols)) {
        if (newCols[key] !== oldCols[key]) patch[key] = newCols[key];
      }
      if (Object.keys(patch).length > 0) updates.push({ kind: 'update', table: spec.table, id, patch });
    }
    if (spec.deletable) {
      for (const id of before.keys()) {
        if (!after.has(id)) deletes.push({ kind: 'delete', table: spec.table, id });
      }
    }
  }

  // Neue Antworten zu Tickets (kommen nach den Tickets, da sie darauf verweisen)
  const oldTickets = byId(prev.tickets);
  for (const ticket of next.tickets) {
    const known = new Set(oldTickets.get(ticket.id)?.comments.map((c) => c.id) ?? []);
    for (const c of ticket.comments) {
      if (known.has(c.id)) continue;
      inserts.push({
        kind: 'insert',
        table: 'ticket_comments',
        id: c.id,
        row: { id: c.id, ticket_id: ticket.id, text: c.text },
      });
    }
  }

  return [...inserts, ...updates, ...deletes];
}

/** Führt die Operationen nacheinander aus; bricht beim ersten Fehler ab. */
export async function applyOps(exec: Executor, ops: Op[]): Promise<void> {
  for (const op of ops) {
    if (op.kind === 'insert') await exec.insert(op.table, op.row);
    else if (op.kind === 'update') await exec.update(op.table, op.id, op.patch);
    else await exec.remove(op.table, op.id);
  }
}
