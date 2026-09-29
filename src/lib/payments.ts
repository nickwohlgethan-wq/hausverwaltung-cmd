import { dueDateOf, monthOf } from './dates';
import { uid } from './ids';
import type { Db, Payment, PaymentStatus, Tenant, Unit } from './types';

export function amountDue(p: Payment): number {
  return p.rentDue + p.utilitiesDue;
}

export function paymentStatus(p: Payment, today: string): PaymentStatus {
  const due = amountDue(p);
  if (p.paid >= due) return 'paid';
  if (dueDateOf(p.month) < today) return 'overdue';
  return p.paid > 0 ? 'partial' : 'open';
}

export function outstanding(p: Payment): number {
  return Math.max(0, amountDue(p) - p.paid);
}

/** Legt für alle Mieter, die im Monat schon eingezogen waren und noch keinen Eintrag haben, eine Sollstellung an. */
export function generateMonth(db: Db, month: string): Payment[] {
  const created: Payment[] = [];
  for (const tenant of db.tenants) {
    if (monthOf(tenant.moveIn) > month) continue;
    if (db.payments.some((p) => p.tenantId === tenant.id && p.month === month)) continue;
    const unit = db.units.find((u) => u.id === tenant.unitId);
    if (!unit) continue;
    created.push(newPayment(tenant, unit, month));
  }
  return created;
}

export function newPayment(tenant: Tenant, unit: Unit, month: string): Payment {
  return {
    id: uid(),
    tenantId: tenant.id,
    month,
    rentDue: unit.baseRent,
    utilitiesDue: unit.utilitiesPrepayment,
    paid: 0,
  };
}

export type MonthSummary = {
  due: number;
  paid: number;
  outstanding: number;
  overdueCount: number;
};

export function summarize(payments: Payment[], today: string): MonthSummary {
  let due = 0;
  let paid = 0;
  let overdueCount = 0;
  for (const p of payments) {
    due += amountDue(p);
    paid += Math.min(p.paid, amountDue(p));
    if (paymentStatus(p, today) === 'overdue') overdueCount += 1;
  }
  return { due, paid, outstanding: due - paid, overdueCount };
}
