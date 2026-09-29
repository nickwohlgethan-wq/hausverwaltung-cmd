/**
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';

import { createTestDb, TEST_DATABASE_URL, type Db } from './db-helpers';

// Läuft nur, wenn ein Postgres bereitsteht: TEST_DATABASE_URL=postgres://… npm test
const suite = TEST_DATABASE_URL ? describe : describe.skip;

const id = () => randomUUID();
const CODE_T1 = '0A1B2C3D4E5F';
const CODE_T2 = '112233445566';
const CODE_TB = 'ABCDEF012345';

/** SQLSTATE 42501: fehlendes Recht (GRANT) oder verletzte RLS-Policy. */
const denied = { code: '42501' };

suite('Datenbank-Zugriffsregeln', () => {
  let db: Db;
  let A: string, B: string, M1: string, M2: string, MB: string, X: string;
  const P1 = id(), U1 = id(), U2 = id(), U3 = id(), T1 = id(), T2 = id();
  const PB = id(), UB = id(), TB = id();
  const PAY_T1_AUG = id(), PAY_T1_SEP = id(), PAY_T2_SEP = id();
  const COST_A = id(), COST_B = id();
  const K1 = id(), K2 = id();

  beforeAll(async () => {
    db = await createTestDb();
    A = await db.createUser({ role: 'verwalter', display_name: 'Verwaltung A' });
    B = await db.createUser({ role: 'verwalter', display_name: 'Verwaltung B' });
    M1 = await db.createUser({ role: 'mieter', display_name: 'Anna' });
    M2 = await db.createUser({ role: 'mieter', display_name: 'Bernd' });
    MB = await db.createUser({ role: 'mieter', display_name: 'Berta' });
    X = await db.createUser({ role: 'mieter', display_name: 'Ohne Einladung' });

    // Verwalter A legt seine Daten an – nur mit den freigegebenen Spalten.
    await db.as(A, `insert into properties (id, name, street, zip, city) values ($1,'Lindenhof','Lindenstr. 1','50667','Köln')`, [P1]);
    for (const [uid, name, area] of [[U1, 'Whg 1', 60], [U2, 'Whg 2', 40], [U3, 'Whg 3', 50]] as const) {
      await db.as(A, `insert into units (id, property_id, name, area_sqm, rooms, base_rent, utilities_prepayment) values ($1,$2,$3,$4,2,60000,20000)`, [uid, P1, name, area]);
    }
    await db.as(A, `insert into tenants (id, unit_id, name, move_in, invite_code) values ($1,$2,'Anna Schneider','2024-01-01',$3)`, [T1, U1, CODE_T1]);
    await db.as(A, `insert into tenants (id, unit_id, name, move_in, invite_code) values ($1,$2,'Bernd Braun','2024-01-01',$3)`, [T2, U2, CODE_T2]);
    for (const [pid, tid, month] of [[PAY_T1_AUG, T1, '2026-08'], [PAY_T1_SEP, T1, '2026-09'], [PAY_T2_SEP, T2, '2026-09']] as const) {
      await db.as(A, `insert into payments (id, tenant_id, month, rent_due, utilities_due) values ($1,$2,$3,60000,20000)`, [pid, tid, month]);
    }
    await db.as(A, `insert into costs (id, property_id, year, category, amount, key) values ($1,$2,2025,'Heizung',100000,'area')`, [COST_A, P1]);

    // Verwalter B mit eigenem Bestand
    await db.as(B, `insert into properties (id, name, street, zip, city) values ($1,'Seeblick','Seestr. 2','80331','München')`, [PB]);
    await db.as(B, `insert into units (id, property_id, name, area_sqm, rooms, base_rent, utilities_prepayment) values ($1,$2,'Whg B',70,3,90000,25000)`, [UB, PB]);
    await db.as(B, `insert into tenants (id, unit_id, name, move_in, invite_code) values ($1,$2,'Berta Bauer','2024-01-01',$3)`, [TB, UB, CODE_TB]);
    await db.as(B, `insert into costs (id, property_id, year, category, amount, key) values ($1,$2,2025,'Heizung',777700,'area')`, [COST_B, PB]);

    // Mieter lösen ihre Einladungen ein (Kleinschreibung und Bindestriche sind erlaubt).
    expect((await db.as(M1, `select claim_tenant('0a1b-2c3d-4e5f') as r`)).rows[0].r).toBe('ok');
    expect((await db.as(M2, `select claim_tenant($1) as r`, [CODE_T2])).rows[0].r).toBe('ok');
    expect((await db.as(MB, `select claim_tenant($1) as r`, [CODE_TB])).rows[0].r).toBe('ok');

    await db.as(M1, `insert into tickets (id, tenant_id, unit_id, title, category) values ($1,$2,$3,'Heizung kalt','Heizung')`, [K1, T1, U1]);
    await db.as(M2, `insert into tickets (id, tenant_id, unit_id, title, category) values ($1,$2,$3,'Tür klemmt','Fenster/Türen')`, [K2, T2, U2]);
  });

  afterAll(async () => {
    await db?.drop();
  });

  const count = async (uid: string, table: string) =>
    Number((await db.as(uid, `select count(*) from ${table}`)).rows[0].count);

  describe('Profile', () => {
    it('übernimmt die Rolle aus der Registrierung', async () => {
      const rows = (await db.admin.query('select id, role, display_name from profiles')).rows;
      expect(rows.find((r) => r.id === A)).toMatchObject({ role: 'verwalter', display_name: 'Verwaltung A' });
      expect(rows.find((r) => r.id === M1)).toMatchObject({ role: 'mieter', display_name: 'Anna' });
    });

    it('fällt bei unbekannter Rolle auf „mieter“ zurück und nutzt die E-Mail als Namen', async () => {
      const u = await db.createUser({ role: 'admin' }, 'karl.klein@example.com');
      const row = (await db.admin.query('select role, display_name from profiles where id = $1', [u])).rows[0];
      expect(row).toEqual({ role: 'mieter', display_name: 'karl.klein' });
    });

    it('lässt Nutzer die eigene Rolle nicht ändern und keine Profile anlegen', async () => {
      await expect(db.as(M1, `update profiles set role = 'verwalter' where id = $1`, [M1])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into profiles (id, role, display_name) values ($1,'verwalter','x')`, [randomUUID()])).rejects.toMatchObject(denied);
      await expect(db.as(A, `delete from profiles where id = $1`, [A])).rejects.toMatchObject(denied);
    });

    it('zeigt nur das eigene Profil', async () => {
      expect(await count(A, 'profiles')).toBe(1);
      expect(await count(M1, 'profiles')).toBe(1);
    });
  });

  describe('Verwalter: Trennung der Arbeitsbereiche', () => {
    it('sieht nur die eigenen Zeilen', async () => {
      expect(await count(A, 'properties')).toBe(1);
      expect(await count(A, 'units')).toBe(3);
      expect(await count(A, 'tenants')).toBe(2);
      expect(await count(A, 'payments')).toBe(3);
      expect(await count(A, 'costs')).toBe(1);
      expect(await count(A, 'tickets')).toBe(2);
      expect(await count(B, 'properties')).toBe(1);
      expect(await count(B, 'units')).toBe(1);
      expect(await count(B, 'payments')).toBe(0);
      expect(await count(B, 'tickets')).toBe(0);
    });

    it('kann fremde Zeilen weder ändern noch löschen', async () => {
      expect((await db.as(B, `update properties set name = 'gehackt' where id = $1`, [P1])).rowCount).toBe(0);
      expect((await db.as(B, `update payments set paid = 99999 where id = $1`, [PAY_T1_SEP])).rowCount).toBe(0);
      expect((await db.as(B, `update tickets set status = 'done' where id = $1`, [K1])).rowCount).toBe(0);
      expect((await db.as(B, `delete from costs where id = $1`, [COST_A])).rowCount).toBe(0);
      const after = (await db.admin.query('select name from properties where id = $1', [P1])).rows[0];
      expect(after.name).toBe('Lindenhof');
      expect((await db.admin.query('select count(*) from costs where id = $1', [COST_A])).rows[0].count).toBe('1');
    });

    it('kann keine Zeilen in fremde Objekte, Wohnungen oder Mieter einhängen', async () => {
      await expect(db.as(B, `insert into units (property_id, name, area_sqm, rooms, base_rent, utilities_prepayment) values ($1,'Eindringling',10,1,1,1)`, [P1])).rejects.toMatchObject({ code: '23503' });
      await expect(db.as(B, `insert into tenants (unit_id, name, move_in) values ($1,'Eindringling','2026-01-01')`, [U3])).rejects.toMatchObject({ code: '23503' });
      await expect(db.as(B, `insert into payments (tenant_id, month, rent_due, utilities_due) values ($1,'2026-10',1,1)`, [T1])).rejects.toMatchObject({ code: '23503' });
      await expect(db.as(B, `insert into costs (property_id, year, category, amount, key) values ($1,2025,'Heizung',1,'area')`, [P1])).rejects.toMatchObject({ code: '23503' });
    });

    it('kann owner_id und user_id nie selbst setzen', async () => {
      await expect(db.as(B, `insert into properties (name, street, zip, city, owner_id) values ('x','x','1','x',$1)`, [A])).rejects.toMatchObject(denied);
      await expect(db.as(A, `update tenants set user_id = $1 where id = $2`, [X, T1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `update properties set owner_id = $1 where id = $2`, [B, P1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `insert into tenants (unit_id, name, move_in, user_id) values ($1,'x','2026-01-01',$2)`, [U3, X])).rejects.toMatchObject(denied);
    });

    it('darf nur Zahlungseingänge ändern, nicht die Sollbeträge', async () => {
      expect((await db.as(A, `update payments set paid = 80000, paid_on = '2026-09-03' where id = $1`, [PAY_T1_SEP])).rowCount).toBe(1);
      await expect(db.as(A, `update payments set rent_due = 1 where id = $1`, [PAY_T1_SEP])).rejects.toMatchObject(denied);
      await expect(db.as(A, `insert into payments (tenant_id, month, rent_due, utilities_due, paid) values ($1,'2026-10',1,1,999)`, [T1])).rejects.toMatchObject(denied);
    });

    it('darf außer Kosten nichts löschen', async () => {
      await expect(db.as(A, `delete from properties where id = $1`, [P1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `delete from units where id = $1`, [U1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `delete from tenants where id = $1`, [T1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `delete from payments where id = $1`, [PAY_T1_AUG])).rejects.toMatchObject(denied);
      await expect(db.as(A, `delete from tickets where id = $1`, [K1])).rejects.toMatchObject(denied);
      const extra = id();
      await db.as(A, `insert into costs (id, property_id, year, category, amount, key) values ($1,$2,2025,'Müll',5000,'units')`, [extra, P1]);
      expect((await db.as(A, `delete from costs where id = $1`, [extra])).rowCount).toBe(1);
    });

    it('sieht Einladungscodes nicht eingelöster Mieter, eingelöste sind leer', async () => {
      const u3tenant = id();
      await db.as(A, `insert into tenants (id, unit_id, name, move_in, invite_code) values ($1,$2,'Neu','2026-01-01','FFFFFFFFFFFF')`, [u3tenant, U3]);
      const rows = (await db.as(A, `select id, invite_code, user_id from tenants`)).rows;
      expect(rows.find((r) => r.id === u3tenant)).toMatchObject({ invite_code: 'FFFFFFFFFFFF', user_id: null });
      expect(rows.find((r) => r.id === T1)).toMatchObject({ invite_code: null, user_id: M1 });
      // Wohnung 3 für spätere Tests wieder frei machen – per Admin, da Verwalter nicht löschen dürfen
      await db.admin.query('delete from tenants where id = $1', [u3tenant]);
    });

    it('kann keine internen Tabellen lesen', async () => {
      await expect(db.as(A, 'select * from auth.users')).rejects.toMatchObject(denied);
      await expect(db.as(A, 'select * from private.claim_attempts')).rejects.toMatchObject(denied);
    });

    it('erzwingt Datenprüfungen', async () => {
      await expect(db.as(A, `insert into payments (tenant_id, month, rent_due, utilities_due) values ($1,'2026-09',1,1)`, [T2])).rejects.toMatchObject({ code: '23505' });
      await expect(db.as(A, `insert into payments (tenant_id, month, rent_due, utilities_due) values ($1,'2026-13',1,1)`, [T2])).rejects.toMatchObject({ code: '23514' });
      await expect(db.as(A, `insert into units (property_id, name, area_sqm, rooms, base_rent, utilities_prepayment) values ($1,'neg',10,1,-5,0)`, [P1])).rejects.toMatchObject({ code: '23514' });
      await expect(db.as(A, `insert into tenants (unit_id, name, move_in) values ($1,'zweiter Mieter','2026-01-01')`, [U1])).rejects.toMatchObject({ code: '23505' });
    });
  });

  describe('Mieter: nur eigene Daten', () => {
    it('sieht genau die eigene Wohnung, Zahlungen, Kosten und Tickets', async () => {
      expect(await count(M1, 'tenants')).toBe(1);
      expect(await count(M1, 'units')).toBe(1);
      expect(await count(M1, 'properties')).toBe(1);
      expect(await count(M1, 'payments')).toBe(2);
      expect(await count(M1, 'costs')).toBe(1);
      expect(await count(M1, 'tickets')).toBe(1);
      const unit = (await db.as(M1, 'select id from units')).rows[0];
      expect(unit.id).toBe(U1);
      const costs = (await db.as(M1, 'select id from costs')).rows;
      expect(costs).toEqual([{ id: COST_A }]);
    });

    it('sieht nichts von Nachbarn und anderen Häusern', async () => {
      expect((await db.as(M1, 'select id from tenants where id = $1', [T2])).rowCount).toBe(0);
      expect((await db.as(M1, 'select id from units where id = any($1)', [[U2, U3, UB]])).rowCount).toBe(0);
      expect((await db.as(M1, 'select id from payments where id = $1', [PAY_T2_SEP])).rowCount).toBe(0);
      expect((await db.as(M1, 'select id from costs where id = $1', [COST_B])).rowCount).toBe(0);
      expect((await db.as(M1, 'select id from tickets where id = $1', [K2])).rowCount).toBe(0);
      expect((await db.as(MB, 'select id from payments')).rowCount).toBe(0);
    });

    it('sieht ohne Einladung gar nichts', async () => {
      for (const t of ['tenants', 'units', 'properties', 'payments', 'costs', 'tickets', 'ticket_comments']) {
        expect(await count(X, t)).toBe(0);
      }
    });

    it('kann Stammdaten, Zahlungen und Kosten nicht anlegen, ändern oder löschen', async () => {
      await expect(db.as(M1, `insert into properties (name, street, zip, city) values ('x','x','1','x')`)).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into payments (tenant_id, month, rent_due, utilities_due) values ($1,'2026-10',0,0)`, [T1])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into costs (property_id, year, category, amount, key) values ($1,2025,'x',1,'area')`, [P1])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into tenants (unit_id, name, move_in) values ($1,'x','2026-01-01')`, [U3])).rejects.toMatchObject(denied);
      // Änderungen an sichtbaren Zeilen laufen ins Leere (0 Zeilen), sie ändern nichts:
      const before = (await db.admin.query('select paid from payments where id = $1', [PAY_T1_AUG])).rows[0].paid;
      expect((await db.as(M1, `update payments set paid = 999999 where id = $1`, [PAY_T1_AUG])).rowCount).toBe(0);
      expect((await db.as(M1, `update units set base_rent = 1 where id = $1`, [U1])).rowCount).toBe(0);
      expect((await db.as(M1, `update tenants set name = 'x' where id = $1`, [T1])).rowCount).toBe(0);
      expect((await db.as(M1, `update tickets set status = 'done' where id = $1`, [K1])).rowCount).toBe(0);
      // RLS überspringt nicht erlaubte Zeilen still: 0 gelöschte Zeilen, die Kostenposition bleibt.
      expect((await db.as(M1, `delete from costs where id = $1`, [COST_A])).rowCount).toBe(0);
      expect((await db.admin.query('select count(*) from costs where id = $1', [COST_A])).rows[0].count).toBe('1');
      const after = (await db.admin.query('select paid from payments where id = $1', [PAY_T1_AUG])).rows[0].paid;
      expect(after).toBe(before);
      expect((await db.admin.query('select status from tickets where id = $1', [K1])).rows[0].status).toBe('open');
    });

    it('legt Tickets nur für sich selbst an; Eigentümer und Status setzt die Datenbank', async () => {
      const row = (await db.admin.query('select owner_id, status, tenant_id, unit_id from tickets where id = $1', [K1])).rows[0];
      expect(row).toEqual({ owner_id: A, status: 'open', tenant_id: T1, unit_id: U1 });
      // für einen Nachbarn
      await expect(db.as(M1, `insert into tickets (tenant_id, unit_id, title, category) values ($1,$2,'x','x')`, [T2, U2])).rejects.toMatchObject(denied);
      // eigene Mieter-ID, fremde Wohnung
      await expect(db.as(M1, `insert into tickets (tenant_id, unit_id, title, category) values ($1,$2,'x','x')`, [T1, U2])).rejects.toMatchObject(denied);
      // Status, Eigentümer und Zeitstempel sind nicht setzbar
      await expect(db.as(M1, `insert into tickets (tenant_id, unit_id, title, category, status) values ($1,$2,'x','x','done')`, [T1, U1])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into tickets (tenant_id, unit_id, title, category, owner_id) values ($1,$2,'x','x',$3)`, [T1, U1, B])).rejects.toMatchObject(denied);
    });

    it('antwortet nur auf eigene Tickets; Autor und Rolle setzt die Datenbank', async () => {
      const c = id();
      await db.as(M1, `insert into ticket_comments (id, ticket_id, text) values ($1,$2,'Danke!')`, [c, K1]);
      const row = (await db.admin.query('select owner_id, author_id, author_role, author_name from ticket_comments where id = $1', [c])).rows[0];
      expect(row).toEqual({ owner_id: A, author_id: M1, author_role: 'mieter', author_name: 'Anna Schneider' });
      await expect(db.as(M1, `insert into ticket_comments (ticket_id, text) values ($1,'Mitlesen')`, [K2])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `insert into ticket_comments (ticket_id, text) values ($1,'x')`, [randomUUID()])).rejects.toBeTruthy();
      await expect(db.as(M1, `insert into ticket_comments (ticket_id, text, author_role) values ($1,'x','verwalter')`, [K1])).rejects.toMatchObject(denied);
      await expect(db.as(M1, `update ticket_comments set text = 'manipuliert' where id = $1`, [c])).rejects.toMatchObject(denied);
    });

    it('sieht Antworten nur auf die eigenen Tickets', async () => {
      await db.as(M2, `insert into ticket_comments (ticket_id, text) values ($1,'geheim')`, [K2]);
      const seen = (await db.as(M1, 'select text from ticket_comments')).rows.map((r) => r.text);
      expect(seen).not.toContain('geheim');
      expect(seen).toContain('Danke!');
    });

    it('bekommt Gesamtfläche und Wohnungszahl des eigenen Hauses, sonst nichts', async () => {
      const rows = (await db.as(M1, 'select * from property_totals()')).rows;
      expect(rows).toEqual([{ property_id: P1, total_area: '150.00', unit_count: 3 }]);
      const other = (await db.as(MB, 'select * from property_totals()')).rows;
      expect(other).toEqual([{ property_id: PB, total_area: '70.00', unit_count: 1 }]);
      expect((await db.as(X, 'select * from property_totals()')).rowCount).toBe(0);
      expect((await db.as(A, 'select * from property_totals()')).rowCount).toBe(0);
    });
  });

  describe('Verwalter und Tickets', () => {
    it('sieht Tickets und Antworten der eigenen Mieter, antwortet und ändert den Status', async () => {
      expect((await db.as(A, 'select id from tickets where id = any($1)', [[K1, K2]])).rowCount).toBe(2);
      const c = id();
      await db.as(A, `insert into ticket_comments (id, ticket_id, text) values ($1,$2,'Monteur kommt morgen')`, [c, K1]);
      const row = (await db.admin.query('select owner_id, author_role, author_name from ticket_comments where id = $1', [c])).rows[0];
      expect(row).toEqual({ owner_id: A, author_role: 'verwalter', author_name: 'Verwaltung A' });
      expect((await db.as(A, `update tickets set status = 'in_progress' where id = $1`, [K1])).rowCount).toBe(1);
      // Der Mieter sieht die Antwort und den neuen Status.
      expect((await db.as(M1, 'select status from tickets where id = $1', [K1])).rows[0].status).toBe('in_progress');
      expect((await db.as(M1, 'select text from ticket_comments where id = $1', [c])).rowCount).toBe(1);
    });

    it('legt selbst keine Tickets an und ändert nur den Status', async () => {
      await expect(db.as(A, `insert into tickets (tenant_id, unit_id, title, category) values ($1,$2,'x','x')`, [T1, U1])).rejects.toMatchObject(denied);
      await expect(db.as(A, `update tickets set title = 'umgeschrieben' where id = $1`, [K1])).rejects.toMatchObject(denied);
    });

    it('kann in fremden Tickets weder lesen noch antworten', async () => {
      expect((await db.as(B, 'select id from tickets')).rowCount).toBe(0);
      expect((await db.as(B, 'select id from ticket_comments')).rowCount).toBe(0);
      await expect(db.as(B, `insert into ticket_comments (ticket_id, text) values ($1,'x')`, [K1])).rejects.toMatchObject(denied);
    });

    it('lässt Mieter-Konten keinen eigenen Arbeitsbereich anlegen', async () => {
      await expect(db.as(X, `insert into properties (name, street, zip, city) values ('x','x','1','x')`)).rejects.toMatchObject(denied);
    });
  });

  describe('Einladungscode', () => {
    it('ist einmalig: ein zweites Konto kann ihn nicht mehr benutzen', async () => {
      expect((await db.as(X, `select claim_tenant($1) as r`, [CODE_T1])).rows[0].r).toBe('invalid');
      expect((await db.admin.query('select user_id, invite_code from tenants where id = $1', [T1])).rows[0]).toEqual({ user_id: M1, invite_code: null });
    });

    it('lehnt unbekannte, leere und fehlerhafte Codes einheitlich ab', async () => {
      const fresh = await db.createUser({ role: 'mieter', display_name: 'Tester' });
      for (const bad of ['', 'nonsense', '000000000000', "' or 1=1 --", '0A1B2C3D4E5F0']) {
        expect((await db.as(fresh, `select claim_tenant($1) as r`, [bad])).rows[0].r).toBe('invalid');
      }
    });

    it('bremst nach fünf Fehlversuchen aus – auch mit gültigem Code', async () => {
      const guesser = await db.createUser({ role: 'mieter', display_name: 'Rater' });
      const spare = id(), spareTenant = id();
      await db.as(A, `insert into tenants (id, unit_id, name, move_in, invite_code) values ($1,$2,'Frei','2026-01-01','ABCABCABCABC')`, [spareTenant, U3]);
      for (let i = 0; i < 5; i++) {
        expect((await db.as(guesser, `select claim_tenant('DEADBEEF0000') as r`)).rows[0].r).toBe('invalid');
      }
      expect((await db.as(guesser, `select claim_tenant('DEADBEEF0000') as r`)).rows[0].r).toBe('throttled');
      expect((await db.as(guesser, `select claim_tenant('ABCABCABCABC') as r`)).rows[0].r).toBe('throttled');
      expect((await db.admin.query('select user_id from tenants where id = $1', [spareTenant])).rows[0].user_id).toBeNull();
      expect(spare).toBeTruthy();
      await db.admin.query('delete from tenants where id = $1', [spareTenant]);
    });

    it('steht nur Mieter-Konten offen, und jedes Konto kann nur einmal verknüpft sein', async () => {
      expect((await db.as(A, `select claim_tenant($1) as r`, [CODE_TB])).rows[0].r).toBe('not_allowed');
      expect((await db.as(M1, `select claim_tenant($1) as r`, [CODE_TB])).rows[0].r).toBe('already_linked');
      expect((await db.admin.query('select user_id from tenants where id = $1', [TB])).rows[0].user_id).toBe(MB);
    });
  });

  describe('Sicher als Standard', () => {
    it('sperrt später angelegte Tabellen zunächst für alle App-Nutzer', async () => {
      await db.admin.query('create table public.spaeter_angelegt (id int)');
      await expect(db.as(A, 'select * from spaeter_angelegt')).rejects.toMatchObject(denied);
      await expect(db.anon('select * from spaeter_angelegt')).rejects.toMatchObject(denied);
      await expect(db.as(A, 'insert into spaeter_angelegt values (1)')).rejects.toMatchObject(denied);
    });
  });

  describe('Nicht angemeldet (anon)', () => {
    it('hat auf keine Tabelle Zugriff', async () => {
      for (const t of ['profiles', 'properties', 'units', 'tenants', 'payments', 'costs', 'tickets', 'ticket_comments']) {
        await expect(db.anon(`select * from ${t}`)).rejects.toMatchObject(denied);
      }
      await expect(db.anon(`insert into properties (name, street, zip, city) values ('x','x','1','x')`)).rejects.toMatchObject(denied);
    });

    it('kann die App-Funktionen nicht aufrufen', async () => {
      await expect(db.anon(`select claim_tenant('0A1B2C3D4E5F')`)).rejects.toMatchObject(denied);
      await expect(db.anon('select * from property_totals()')).rejects.toMatchObject(denied);
    });
  });
});
