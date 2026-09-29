import { createSeed } from '../seed';
import { computeStatement, defaultKey, occupiedMonths } from '../utilities';
import type { Db } from '../types';

describe('occupiedMonths', () => {
  it('zählt volle Jahre', () => {
    expect(occupiedMonths('2022-04-01', 2025)).toBe(12);
  });
  it('zählt den Einzugsmonat voll mit', () => {
    expect(occupiedMonths('2025-07-15', 2025)).toBe(6);
    expect(occupiedMonths('2025-01-01', 2025)).toBe(12);
    expect(occupiedMonths('2025-12-31', 2025)).toBe(1);
  });
  it('ist 0 vor dem Einzug', () => {
    expect(occupiedMonths('2026-02-01', 2025)).toBe(0);
  });
});

describe('defaultKey', () => {
  it('verteilt Wasser und Müll nach Wohneinheiten, den Rest nach Fläche', () => {
    expect(defaultKey('Wasser/Abwasser')).toBe('units');
    expect(defaultKey('Heizung')).toBe('area');
  });
});

describe('computeStatement', () => {
  const db: Db = {
    properties: [{ id: 'p', name: 'H', street: 's', zip: '1', city: 'c' }],
    units: [
      { id: 'a', propertyId: 'p', name: 'A', floor: '', areaSqm: 50, rooms: 2, baseRent: 0, utilitiesPrepayment: 10000 },
      { id: 'b', propertyId: 'p', name: 'B', floor: '', areaSqm: 150, rooms: 4, baseRent: 0, utilitiesPrepayment: 30000 },
    ],
    tenants: [
      { id: 'ta', unitId: 'a', name: 'A', email: '', phone: '', moveIn: '2020-01-01' },
      { id: 'tb', unitId: 'b', name: 'B', email: '', phone: '', moveIn: '2025-07-01' },
    ],
    payments: [],
    costs: [
      { id: 'c1', propertyId: 'p', year: 2025, category: 'Heizung', amount: 100000, key: 'area' },
      { id: 'c2', propertyId: 'p', year: 2025, category: 'Wasser/Abwasser', amount: 60000, key: 'units' },
      { id: 'c3', propertyId: 'p', year: 2024, category: 'Heizung', amount: 999999, key: 'area' },
      { id: 'c4', propertyId: 'other', year: 2025, category: 'Heizung', amount: 999999, key: 'area' },
    ],
    tickets: [],
  };

  it('verteilt nach Fläche und Einheiten und bilanziert gegen die Vorauszahlung', () => {
    const s = computeStatement(db, db.tenants[0], 2025)!;
    expect(s.months).toBe(12);
    expect(s.lines.map((l) => [l.category, l.share])).toEqual([
      ['Heizung', 25000], // 50 / 200 m²
      ['Wasser/Abwasser', 30000], // 1 / 2 Einheiten
    ]);
    expect(s.totalShare).toBe(55000);
    expect(s.prepaid).toBe(120000);
    expect(s.balance).toBe(-65000); // Guthaben
  });

  it('berücksichtigt nur die bewohnten Monate', () => {
    const s = computeStatement(db, db.tenants[1], 2025)!;
    expect(s.months).toBe(6);
    expect(s.lines.map((l) => l.share)).toEqual([37500, 15000]); // halbes Jahr: 75 % bzw. 50 %
    expect(s.prepaid).toBe(30000 * 6);
    expect(s.balance).toBe(52500 - 180000);
  });

  it('ist für ein Jahr ohne Kosten leer, aber Vorauszahlungen bleiben sichtbar', () => {
    const s = computeStatement(db, db.tenants[0], 2023)!;
    expect(s.lines).toHaveLength(0);
    expect(s.balance).toBe(-120000);
  });

  it('gibt null zurück, wenn die Wohnung fehlt', () => {
    expect(computeStatement({ ...db, units: [] }, db.tenants[0], 2025)).toBeNull();
  });

  it('summiert die Anteile aller Mieter höchstens auf die Gesamtkosten', () => {
    const full = { ...db, tenants: db.tenants.map((t) => ({ ...t, moveIn: '2020-01-01' })) };
    const total = full.tenants.reduce((s, t) => s + computeStatement(full, t, 2025)!.totalShare, 0);
    expect(total).toBe(160000);
  });
});

describe('Demo-Daten', () => {
  const now = new Date(2026, 8, 29);
  const db = createSeed(now);

  it('sind in sich konsistent', () => {
    for (const u of db.units) expect(db.properties.some((p) => p.id === u.propertyId)).toBe(true);
    for (const t of db.tenants) expect(db.units.some((u) => u.id === t.unitId)).toBe(true);
    for (const p of db.payments) expect(db.tenants.some((t) => t.id === p.tenantId)).toBe(true);
    for (const k of db.tickets) expect(db.tenants.find((t) => t.id === k.tenantId)?.unitId).toBe(k.unitId);
    expect(new Set(db.payments.map((p) => p.id)).size).toBe(db.payments.length);
    expect(new Set(db.costs.map((c) => c.id)).size).toBe(db.costs.length);
  });

  it('liefern realistische Abrechnungen für das Vorjahr', () => {
    for (const t of db.tenants) {
      const s = computeStatement(db, t, 2025)!;
      expect(s.lines.length).toBeGreaterThan(0);
      expect(Math.abs(s.balance)).toBeLessThan(s.prepaid);
    }
  });
});
