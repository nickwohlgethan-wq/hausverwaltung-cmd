import type { AllocationKey, CostItem, Db, PropertyTotals, Tenant } from './types';

export const COST_CATEGORIES = [
  'Heizung',
  'Wasser/Abwasser',
  'Müllabfuhr',
  'Hausmeister',
  'Gebäudeversicherung',
  'Grundsteuer',
  'Allgemeinstrom',
  'Sonstiges',
] as const;

export const ALLOCATION_LABEL: Record<AllocationKey, string> = {
  area: 'nach Wohnfläche',
  units: 'nach Wohneinheiten',
};

/** Sinnvolle Voreinstellung je Kostenart. */
export function defaultKey(category: string): AllocationKey {
  return category === 'Wasser/Abwasser' || category === 'Müllabfuhr' ? 'units' : 'area';
}

/**
 * Anzahl Monate im Jahr, in denen der Mieter (ab Einzugsmonat) in der Wohnung gewohnt hat.
 * Der Einzugsmonat zählt voll.
 */
export function occupiedMonths(moveIn: string, year: number): number {
  const moveInYear = Number(moveIn.slice(0, 4));
  const moveInMonth = Number(moveIn.slice(5, 7));
  if (moveInYear < year) return 12;
  if (moveInYear > year) return 0;
  return 12 - moveInMonth + 1;
}

export type StatementLine = {
  costId: string;
  category: string;
  key: AllocationKey;
  total: number;
  /** Anteil der Wohnung an den Gesamtkosten (0–1) */
  ratio: number;
  share: number;
};

export type Statement = {
  tenantId: string;
  unitId: string;
  propertyId: string;
  year: number;
  months: number;
  lines: StatementLine[];
  totalShare: number;
  prepaid: number;
  /** > 0: Nachzahlung durch den Mieter, < 0: Guthaben */
  balance: number;
};

/** Gesamtfläche und Wohnungszahl des Hauses; bei Mietern kommen sie vom Server. */
export function propertyTotals(db: Db, propertyId: string): PropertyTotals {
  const given = db.totals?.[propertyId];
  if (given) return given;
  const units = db.units.filter((u) => u.propertyId === propertyId);
  return { totalArea: units.reduce((sum, u) => sum + u.areaSqm, 0), unitCount: units.length };
}

/**
 * Berechnet die Nebenkostenabrechnung eines Mieters für ein Jahr.
 * Leerstehende Wohnungen zählen bei der Verteilung mit, ihr Anteil bleibt beim Eigentümer.
 * Vorauszahlungen sind die Soll-Vorauszahlungen der bewohnten Monate.
 */
export function computeStatement(db: Db, tenant: Tenant, year: number): Statement | null {
  const unit = db.units.find((u) => u.id === tenant.unitId);
  if (!unit) return null;
  const { totalArea, unitCount } = propertyTotals(db, unit.propertyId);
  const months = occupiedMonths(tenant.moveIn, year);
  const costs = db.costs.filter((c) => c.propertyId === unit.propertyId && c.year === year);

  const lines = costs.map((c) => toLine(c, unit.areaSqm, totalArea, unitCount, months));
  const totalShare = lines.reduce((sum, l) => sum + l.share, 0);
  const prepaid = unit.utilitiesPrepayment * months;

  return {
    tenantId: tenant.id,
    unitId: unit.id,
    propertyId: unit.propertyId,
    year,
    months,
    lines,
    totalShare,
    prepaid,
    balance: totalShare - prepaid,
  };
}

function toLine(
  c: CostItem,
  unitArea: number,
  totalArea: number,
  unitCount: number,
  months: number,
): StatementLine {
  const ratio =
    c.key === 'area'
      ? totalArea > 0
        ? unitArea / totalArea
        : 0
      : unitCount > 0
        ? 1 / unitCount
        : 0;
  return {
    costId: c.id,
    category: c.category,
    key: c.key,
    total: c.amount,
    ratio,
    share: Math.round(c.amount * ratio * (months / 12)),
  };
}
