/** Alle Geldbeträge sind ganze Cent-Beträge (Integer), Datumswerte ISO-Strings (YYYY-MM-DD). */

export type Property = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  name: string;
  floor: string;
  areaSqm: number;
  rooms: number;
  /** Kaltmiete pro Monat */
  baseRent: number;
  /** Nebenkosten-Vorauszahlung pro Monat */
  utilitiesPrepayment: number;
};

export type Tenant = {
  id: string;
  unitId: string;
  name: string;
  email: string;
  phone: string;
  /** Einzugsdatum, ISO */
  moveIn: string;
  /** Einmaliger Einladungscode (12 Zeichen), solange der Mieter sich noch nicht registriert hat */
  inviteCode: string | null;
  /** true, sobald der Mieter ein Konto mit dem Einladungscode verknüpft hat */
  claimed: boolean;
};

export type Payment = {
  id: string;
  tenantId: string;
  /** Monat im Format YYYY-MM */
  month: string;
  rentDue: number;
  utilitiesDue: number;
  paid: number;
  paidOn?: string;
};

export type PaymentStatus = 'paid' | 'partial' | 'open' | 'overdue';

export type AllocationKey = 'area' | 'units';

export type CostItem = {
  id: string;
  propertyId: string;
  year: number;
  category: string;
  amount: number;
  key: AllocationKey;
};

export type TicketStatus = 'open' | 'in_progress' | 'done';
export type TicketPriority = 'low' | 'normal' | 'urgent';

export type Role = 'verwalter' | 'mieter';

export type TicketComment = {
  id: string;
  authorRole: Role;
  authorName: string;
  text: string;
  at: string;
};

export type Ticket = {
  id: string;
  tenantId: string;
  unitId: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  comments: TicketComment[];
};

/** Gesamtfläche und Wohnungszahl eines Hauses (für die Verteilung der Nebenkosten). */
export type PropertyTotals = { totalArea: number; unitCount: number };

export type Db = {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  costs: CostItem[];
  tickets: Ticket[];
  /**
   * Nur für Mieter gesetzt: Sie sehen nur die eigene Wohnung, brauchen für die Abrechnung aber
   * die Summen des Hauses. Für Verwalter fehlt das Feld, die Summen ergeben sich aus `units`.
   */
  totals?: Record<string, PropertyTotals>;
};

export const EMPTY_DB: Db = {
  properties: [],
  units: [],
  tenants: [],
  payments: [],
  costs: [],
  tickets: [],
};

export type Profile = { id: string; role: Role; displayName: string };

export type Session = { role: 'verwalter' } | { role: 'mieter'; tenantId: string };
