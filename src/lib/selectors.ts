import type { Db, Property, Tenant, Ticket, Unit } from './types';

export function unitsOf(db: Db, propertyId: string): Unit[] {
  return db.units.filter((u) => u.propertyId === propertyId);
}

export function tenantOfUnit(db: Db, unitId: string): Tenant | undefined {
  return db.tenants.find((t) => t.unitId === unitId);
}

export function propertyOfUnit(db: Db, unit: Unit): Property | undefined {
  return db.properties.find((p) => p.id === unit.propertyId);
}

/** "Lindenhof · Wohnung 1 (EG links)" */
export function unitLabel(db: Db, unitId: string): string {
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return 'Unbekannte Wohnung';
  const property = propertyOfUnit(db, unit);
  const floor = unit.floor ? ` (${unit.floor})` : '';
  return `${property?.name ?? '?'} · ${unit.name}${floor}`;
}

export function unitTitle(unit: Unit): string {
  return unit.floor ? `${unit.name} (${unit.floor})` : unit.name;
}

export function addressOf(p: Property): string {
  return `${p.street}, ${p.zip} ${p.city}`;
}

/** Neueste zuerst; offene vor erledigten. */
export function sortTickets(tickets: Ticket[]): Ticket[] {
  const rank = (t: Ticket) => (t.status === 'done' ? 1 : 0);
  return [...tickets].sort(
    (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function openTicketCount(tickets: Ticket[]): number {
  return tickets.filter((t) => t.status !== 'done').length;
}
