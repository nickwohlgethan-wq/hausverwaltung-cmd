import { createSeed } from '../__fixtures__/seed';
import { formatInviteCode, isValidInviteCode, newInviteCode, normalizeInviteCode, uid } from '../ids';
import { reducer } from '../reducer';
import { diffDb, type Op } from '../repo';

const now = new Date(2026, 8, 29);
const db = createSeed(now);
const tables = (ops: Op[]) => ops.map((o) => `${o.kind}:${o.table}`);

describe('diffDb', () => {
  it('erzeugt keine Operationen ohne Änderung', () => {
    expect(diffDb(db, db)).toEqual([]);
    expect(diffDb(db, { ...db, units: [...db.units] })).toEqual([]);
  });

  it('legt Objekt, Wohnung und Mieter in Abhängigkeitsreihenfolge an', () => {
    const p = { id: uid(), name: 'N', street: 's', zip: '1', city: 'c' };
    const u = { id: uid(), propertyId: p.id, name: 'W', floor: '', areaSqm: 50, rooms: 2, baseRent: 1, utilitiesPrepayment: 1 };
    const t = { id: uid(), unitId: u.id, name: 'T', email: '', phone: '', moveIn: '2026-01-01', inviteCode: 'AAAAAAAAAAAA', claimed: false };
    // absichtlich in „falscher“ Reihenfolge aufgebaut
    const next = { ...db, tenants: [...db.tenants, t], units: [...db.units, u], properties: [...db.properties, p] };
    expect(tables(diffDb(db, next))).toEqual(['insert:properties', 'insert:units', 'insert:tenants']);
  });

  it('sendet beim Anlegen nur beschreibbare Spalten (kein owner_id, user_id, paid, status)', () => {
    const tenant = { id: uid(), unitId: 'u5', name: 'N', email: '', phone: '', moveIn: '2026-01-01', inviteCode: 'BBBBBBBBBBBB', claimed: false };
    const withTenant = reducer(db, { type: 'saveTenant', tenant });
    const [op] = diffDb(db, withTenant);
    expect(Object.keys((op as Extract<Op, { kind: 'insert' }>).row).sort()).toEqual(
      ['email', 'id', 'invite_code', 'move_in', 'name', 'phone', 'unit_id'],
    );
    const payments = reducer(db, { type: 'generateMonth', month: '2026-10' });
    const p = diffDb(db, payments)[0] as Extract<Op, { kind: 'insert' }>;
    expect(Object.keys(p.row).sort()).toEqual(['id', 'month', 'rent_due', 'tenant_id', 'utilities_due']);
    const ticket = { ...db.tickets[0], id: uid(), comments: [] };
    const t = diffDb(db, reducer(db, { type: 'createTicket', ticket }))[0] as Extract<Op, { kind: 'insert' }>;
    expect(Object.keys(t.row).sort()).toEqual(['category', 'description', 'id', 'priority', 'tenant_id', 'title', 'unit_id']);
  });

  it('sendet bei Änderungen nur geänderte Spalten', () => {
    const tenant = db.tenants[0];
    const ops = diffDb(db, reducer(db, { type: 'saveTenant', tenant: { ...tenant, phone: '123' } }));
    expect(ops).toEqual([{ kind: 'update', table: 'tenants', id: tenant.id, patch: { phone: '123' } }]);
  });

  it('bucht Zahlungen als Update und storniert mit null', () => {
    const p = db.payments.find((x) => x.paid === 0)!;
    const booked = reducer(db, { type: 'bookPayment', id: p.id, paid: 500, paidOn: '2026-09-29' });
    expect(diffDb(db, booked)).toEqual([{ kind: 'update', table: 'payments', id: p.id, patch: { paid: 500, paid_on: '2026-09-29' } }]);
    const reset = reducer(booked, { type: 'bookPayment', id: p.id, paid: 0 });
    expect(diffDb(booked, reset)).toEqual([{ kind: 'update', table: 'payments', id: p.id, patch: { paid: 0, paid_on: null } }]);
  });

  it('sendet neue Antworten als eigene Zeilen und nur den Text', () => {
    const ticket = db.tickets[0];
    const c = { id: uid(), authorRole: 'mieter' as const, authorName: 'x', text: 'Hallo', at: now.toISOString() };
    const ops = diffDb(db, reducer(db, { type: 'addComment', ticketId: ticket.id, comment: c }));
    expect(ops).toEqual([{ kind: 'insert', table: 'ticket_comments', id: c.id, row: { id: c.id, ticket_id: ticket.id, text: 'Hallo' } }]);
  });

  it('löscht nur Kosten; verschwundene andere Zeilen erzeugen keine Löschbefehle', () => {
    const cost = db.costs[0];
    expect(diffDb(db, reducer(db, { type: 'deleteCost', id: cost.id }))).toEqual([{ kind: 'delete', table: 'costs', id: cost.id }]);
    expect(diffDb(db, { ...db, properties: [] })).toEqual([]);
  });

  it('ordnet Anlegen vor Ändern vor Löschen', () => {
    const cost = db.costs[0];
    let next = reducer(db, { type: 'deleteCost', id: cost.id });
    next = reducer(next, { type: 'setTicketStatus', id: db.tickets[0].id, status: 'done' });
    next = reducer(next, { type: 'generateMonth', month: '2026-10' });
    const kinds = diffDb(db, next).map((o) => o.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => ['insert', 'update', 'delete'].indexOf(a) - ['insert', 'update', 'delete'].indexOf(b)));
    expect(new Set(kinds)).toEqual(new Set(['insert', 'update', 'delete']));
  });
});

describe('Einladungscodes und IDs', () => {
  it('erzeugt gültige, verschiedene Codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => newInviteCode()));
    expect(codes.size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{12}$/);
  });

  it('formatiert und normalisiert', () => {
    expect(formatInviteCode('0A1B2C3D4E5F')).toBe('0A1B-2C3D-4E5F');
    expect(normalizeInviteCode(' 0a1b-2c3d 4e5f ')).toBe('0A1B2C3D4E5F');
    expect(isValidInviteCode('0a1b-2c3d-4e5f')).toBe(true);
    expect(isValidInviteCode('0A1B-2C3D')).toBe(false);
    expect(isValidInviteCode('ZZZZ-ZZZZ-ZZZZ')).toBe(false);
  });

  it('vergibt UUIDs', () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
