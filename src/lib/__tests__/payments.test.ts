import { generateMonth, paymentStatus, summarize } from '../payments';
import { reducer } from '../reducer';
import { createSeed } from '../__fixtures__/seed';
import type { Payment } from '../types';

const base: Payment = {
  id: 'x',
  tenantId: 't1',
  month: '2026-09',
  rentDue: 60000,
  utilitiesDue: 20000,
  paid: 0,
};

describe('paymentStatus', () => {
  it('ist offen vor der Fälligkeit', () => {
    expect(paymentStatus(base, '2026-09-02')).toBe('open');
  });
  it('ist am Fälligkeitstag noch nicht überfällig', () => {
    expect(paymentStatus(base, '2026-09-03')).toBe('open');
  });
  it('ist nach Fälligkeit überfällig', () => {
    expect(paymentStatus(base, '2026-09-04')).toBe('overdue');
    expect(paymentStatus({ ...base, paid: 100 }, '2026-09-04')).toBe('overdue');
  });
  it('erkennt Teilzahlung vor Fälligkeit', () => {
    expect(paymentStatus({ ...base, paid: 100 }, '2026-09-01')).toBe('partial');
  });
  it('ist bezahlt bei voller oder höherer Zahlung', () => {
    expect(paymentStatus({ ...base, paid: 80000 }, '2026-12-01')).toBe('paid');
    expect(paymentStatus({ ...base, paid: 90000 }, '2026-12-01')).toBe('paid');
  });
});

describe('summarize', () => {
  it('summiert Soll, Eingang und Rückstand; Überzahlung zählt nur bis zum Soll', () => {
    const s = summarize(
      [
        { ...base, paid: 90000 },
        { ...base, id: 'y', paid: 20000 },
      ],
      '2026-09-10',
    );
    expect(s.due).toBe(160000);
    expect(s.paid).toBe(100000);
    expect(s.outstanding).toBe(60000);
    expect(s.overdueCount).toBe(1);
  });
});

describe('generateMonth', () => {
  const db = createSeed(new Date(2026, 8, 29));

  it('legt nur fehlende Zahlungen für eingezogene Mieter an', () => {
    expect(generateMonth(db, '2026-10')).toHaveLength(db.tenants.length);
    expect(generateMonth(db, '2026-09')).toHaveLength(0);
  });

  it('legt nichts vor dem Einzug an', () => {
    expect(generateMonth({ ...db, payments: [] }, '2021-06').map((p) => p.tenantId)).toEqual(['t4']);
  });

  it('übernimmt die aktuellen Mietwerte der Wohnung', () => {
    const [p] = generateMonth(db, '2026-10').filter((x) => x.tenantId === 't1');
    expect(p.rentDue).toBe(62000);
    expect(p.utilitiesDue).toBe(20500);
    expect(p.paid).toBe(0);
  });

  it('ist über den Reducer idempotent', () => {
    const once = reducer(db, { type: 'generateMonth', month: '2026-10' });
    const twice = reducer(once, { type: 'generateMonth', month: '2026-10' });
    expect(twice.payments).toHaveLength(once.payments.length);
  });
});

describe('bookPayment', () => {
  it('bucht und storniert Zahlungen', () => {
    const db = createSeed(new Date(2026, 8, 29));
    const target = db.payments.find((p) => p.paid === 0)!;
    const booked = reducer(db, { type: 'bookPayment', id: target.id, paid: 5000, paidOn: '2026-09-29' });
    expect(booked.payments.find((p) => p.id === target.id)).toMatchObject({ paid: 5000, paidOn: '2026-09-29' });
    const undone = reducer(booked, { type: 'bookPayment', id: target.id, paid: 0, paidOn: '2026-09-29' });
    expect(undone.payments.find((p) => p.id === target.id)?.paidOn).toBeUndefined();
  });
});
