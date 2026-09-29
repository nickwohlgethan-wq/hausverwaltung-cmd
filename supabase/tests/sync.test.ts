/**
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';

import { newInviteCode, uid } from '../../src/lib/ids';
import { generateMonth } from '../../src/lib/payments';
import { reducer, type Action } from '../../src/lib/reducer';
import { applyOps, diffDb, fetchAll } from '../../src/lib/repo';
import { EMPTY_DB, type Db } from '../../src/lib/types';
import { computeStatement } from '../../src/lib/utilities';
import { createTestDb, TEST_DATABASE_URL, type Db as TestDb } from './db-helpers';
import { pgExecutor } from './pg-executor';

// Prüft die Sync-Schicht der App (App-Modell ⇄ Zeilen) gegen die echte Datenbank samt Zugriffsregeln.
const suite = TEST_DATABASE_URL ? describe : describe.skip;

const sorted = (db: Db): Db => {
  const by = <T extends { id: string }>(l: T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
  return { ...db, properties: by(db.properties), units: by(db.units), tenants: by(db.tenants), payments: by(db.payments), costs: by(db.costs), tickets: by(db.tickets) };
};

suite('Sync App ⇄ Datenbank', () => {
  let pg: TestDb;
  let A: string, M: string, X: string;
  let local: Db = EMPTY_DB;

  beforeAll(async () => {
    pg = await createTestDb();
    A = await pg.createUser({ role: 'verwalter', display_name: 'Hausverwaltung Müller' });
    M = await pg.createUser({ role: 'mieter', display_name: 'Anna' });
    X = await pg.createUser({ role: 'verwalter', display_name: 'Fremder Verwalter' });
  });
  afterAll(async () => {
    await pg?.drop();
  });

  /** Führt eine Aktion wie der Store aus: lokal anwenden, Diff bilden, an die Datenbank senden. */
  async function act(userId: string, current: Db, action: Action): Promise<Db> {
    const next = reducer(current, action);
    await applyOps(pgExecutor(pg, userId), diffDb(current, next));
    return next;
  }

  const propertyId = uid(), unitId = uid(), unit2Id = uid(), tenantId = uid();
  const code = newInviteCode();

  it('schreibt und liest den kompletten Verwalter-Bestand verlustfrei', async () => {
    let db = EMPTY_DB;
    db = await act(A, db, { type: 'saveProperty', property: { id: propertyId, name: 'Lindenhof', street: 'Lindenstraße 12', zip: '50667', city: 'Köln' } });
    db = await act(A, db, { type: 'saveUnit', unit: { id: unitId, propertyId, name: 'Wohnung 1', floor: 'EG', areaSqm: 58.5, rooms: 2.5, baseRent: 62000, utilitiesPrepayment: 20500 } });
    db = await act(A, db, { type: 'saveUnit', unit: { id: unit2Id, propertyId, name: 'Wohnung 2', floor: '', areaSqm: 91.5, rooms: 4, baseRent: 99000, utilitiesPrepayment: 32500 } });
    db = await act(A, db, { type: 'saveTenant', tenant: { id: tenantId, unitId, name: 'Anna Schneider', email: 'anna@example.com', phone: '0221 1', moveIn: '2022-04-01', inviteCode: code, claimed: false } });
    db = await act(A, db, { type: 'generateMonth', month: '2026-08' });
    db = await act(A, db, { type: 'generateMonth', month: '2026-09' });
    const sep = db.payments.find((p) => p.month === '2026-09')!;
    db = await act(A, db, { type: 'bookPayment', id: sep.id, paid: 82500, paidOn: '2026-09-03' });
    const costId = uid();
    db = await act(A, db, { type: 'saveCost', cost: { id: costId, propertyId, year: 2025, category: 'Heizung', amount: 428000, key: 'area' } });
    db = await act(A, db, { type: 'saveCost', cost: { id: uid(), propertyId, year: 2025, category: 'Müllabfuhr', amount: 68400, key: 'units' } });
    db = await act(A, db, { type: 'deleteCost', id: costId });
    local = db;

    const fetched = await fetchAll(pgExecutor(pg, A), 'verwalter');
    expect(sorted(fetched)).toEqual(sorted(local));
    expect(fetched.payments).toHaveLength(2);
    expect(fetched.costs).toHaveLength(1);
  });

  it('sendet bei Änderungen nur die geänderten Spalten', async () => {
    // Ein anderes Gerät ändert zwischenzeitlich die Telefonnummer …
    await pg.admin.query(`update tenants set phone = 'neu vom anderen Gerät' where id = $1`, [tenantId]);
    // … dieses Gerät ändert nur den Namen und darf die Nummer nicht zurückschreiben.
    const t = local.tenants[0];
    local = await act(A, local, { type: 'saveTenant', tenant: { ...t, name: 'Anna Schneider-Meier' } });
    const row = (await pg.admin.query('select name, phone from tenants where id = $1', [tenantId])).rows[0];
    expect(row).toEqual({ name: 'Anna Schneider-Meier', phone: 'neu vom anderen Gerät' });
  });

  it('ändert Wohnung und Objekt', async () => {
    const u = local.units[0];
    local = await act(A, local, { type: 'saveUnit', unit: { ...u, baseRent: 65000, rooms: 3 } });
    const p = local.properties[0];
    local = await act(A, local, { type: 'saveProperty', property: { ...p, city: 'Bonn' } });
    const fetched = await fetchAll(pgExecutor(pg, A), 'verwalter');
    expect(fetched.units.find((x) => x.id === u.id)).toMatchObject({ baseRent: 65000, rooms: 3 });
    expect(fetched.properties[0].city).toBe('Bonn');
  });

  it('zeigt den Einladungscode bis zum Einlösen und danach den Status', async () => {
    let fetched = await fetchAll(pgExecutor(pg, A), 'verwalter');
    expect(fetched.tenants[0]).toMatchObject({ inviteCode: code, claimed: false });
    expect((await pg.as(M, 'select claim_tenant($1) as r', [code])).rows[0].r).toBe('ok');
    fetched = await fetchAll(pgExecutor(pg, A), 'verwalter');
    expect(fetched.tenants[0]).toMatchObject({ inviteCode: null, claimed: true });
  });

  it('gibt dem Mieter genau seine Sicht samt Haus-Summen für die Abrechnung', async () => {
    const mieter = await fetchAll(pgExecutor(pg, M), 'mieter');
    expect(mieter.properties).toHaveLength(1);
    expect(mieter.units.map((u) => u.id)).toEqual([unitId]); // Wohnung 2 bleibt verborgen
    expect(mieter.tenants).toHaveLength(1);
    expect(mieter.payments).toHaveLength(2);
    expect(mieter.costs).toHaveLength(1);
    expect(mieter.totals).toEqual({ [propertyId]: { totalArea: 150, unitCount: 2 } });

    // Die Abrechnung des Mieters stimmt mit der des Verwalters überein, obwohl der Mieter nur seine
    // eigene Wohnung sieht.
    const verwalter = await fetchAll(pgExecutor(pg, A), 'verwalter');
    const asTenant = computeStatement(mieter, mieter.tenants[0], 2025)!;
    const asManager = computeStatement(verwalter, verwalter.tenants[0], 2025)!;
    expect(asTenant).toEqual(asManager);
    expect(asTenant.lines.map((l) => l.share)).toEqual([Math.round(68400 * 0.5 * (12 / 12))]);
  });

  it('legt Mieter-Tickets an, Verwalter antwortet, Status wird gesetzt', async () => {
    let mieter = await fetchAll(pgExecutor(pg, M), 'mieter');
    const ticketId = uid();
    mieter = await act(M, mieter, {
      type: 'createTicket',
      ticket: { id: ticketId, tenantId, unitId, title: 'Heizung kalt', description: 'Bad', category: 'Heizung', priority: 'urgent', status: 'open', createdAt: new Date().toISOString(), comments: [] },
    });
    mieter = await act(M, mieter, { type: 'addComment', ticketId, comment: { id: uid(), authorRole: 'mieter', authorName: 'egal', text: 'Seit gestern.', at: new Date().toISOString() } });

    let verwalter = await fetchAll(pgExecutor(pg, A), 'verwalter');
    verwalter = await act(A, verwalter, { type: 'addComment', ticketId, comment: { id: uid(), authorRole: 'verwalter', authorName: 'egal', text: 'Monteur kommt.', at: new Date().toISOString() } });
    verwalter = await act(A, verwalter, { type: 'setTicketStatus', id: ticketId, status: 'in_progress' });

    const final = await fetchAll(pgExecutor(pg, M), 'mieter');
    expect(final.tickets).toHaveLength(1);
    expect(final.tickets[0]).toMatchObject({ title: 'Heizung kalt', priority: 'urgent', status: 'in_progress' });
    // Autorenname und Rolle bestimmt die Datenbank, nicht der (hier absichtlich falsche) Client-Wert.
    expect(final.tickets[0].comments.map((c) => [c.authorRole, c.authorName, c.text])).toEqual([
      ['mieter', 'Anna Schneider-Meier', 'Seit gestern.'],
      ['verwalter', 'Hausverwaltung Müller', 'Monteur kommt.'],
    ]);
  });

  it('meldet verworfene Änderungen als Fehler statt sie zu verschlucken', async () => {
    const mieter = await fetchAll(pgExecutor(pg, M), 'mieter');
    const payment = mieter.payments[0];
    // Ein Mieter, der lokal (z. B. durch einen Fehler in der App) eine Zahlung bucht, darf nichts ändern – und erfährt es.
    await expect(act(M, mieter, { type: 'bookPayment', id: payment.id, paid: 1, paidOn: '2026-09-01' })).rejects.toMatchObject({ code: 'not_found' });
    // Nicht erlaubte Anlage schlägt ebenfalls sichtbar fehl.
    await expect(act(M, mieter, { type: 'saveProperty', property: { id: randomUUID(), name: 'x', street: 'x', zip: '1', city: 'x' } })).rejects.toMatchObject({ code: '42501' });
  });

  it('gibt einem fremden Verwalter nichts von alledem', async () => {
    const other = await fetchAll(pgExecutor(pg, X), 'verwalter');
    expect(other).toEqual(EMPTY_DB);
  });
});
