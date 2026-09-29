import { generateMonth } from './payments';
import type {
  CostItem,
  Db,
  Property,
  Tenant,
  Ticket,
  TicketComment,
  TicketStatus,
  Unit,
} from './types';

export type Action =
  | { type: 'replace'; db: Db }
  | { type: 'saveProperty'; property: Property }
  | { type: 'saveUnit'; unit: Unit }
  | { type: 'saveTenant'; tenant: Tenant }
  | { type: 'bookPayment'; id: string; paid: number; paidOn?: string }
  | { type: 'generateMonth'; month: string }
  | { type: 'saveCost'; cost: CostItem }
  | { type: 'deleteCost'; id: string }
  | { type: 'createTicket'; ticket: Ticket }
  | { type: 'setTicketStatus'; id: string; status: TicketStatus }
  | { type: 'addComment'; ticketId: string; comment: TicketComment };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

export function reducer(db: Db, action: Action): Db {
  switch (action.type) {
    case 'replace':
      return action.db;
    case 'saveProperty':
      return { ...db, properties: upsert(db.properties, action.property) };
    case 'saveUnit':
      return { ...db, units: upsert(db.units, action.unit) };
    case 'saveTenant':
      return { ...db, tenants: upsert(db.tenants, action.tenant) };
    case 'bookPayment':
      return {
        ...db,
        payments: db.payments.map((p) =>
          p.id === action.id
            ? { ...p, paid: action.paid, paidOn: action.paid > 0 ? action.paidOn : undefined }
            : p,
        ),
      };
    case 'generateMonth':
      return { ...db, payments: [...db.payments, ...generateMonth(db, action.month)] };
    case 'saveCost':
      return { ...db, costs: upsert(db.costs, action.cost) };
    case 'deleteCost':
      return { ...db, costs: db.costs.filter((c) => c.id !== action.id) };
    case 'createTicket':
      return { ...db, tickets: [action.ticket, ...db.tickets] };
    case 'setTicketStatus':
      return {
        ...db,
        tickets: db.tickets.map((t) => (t.id === action.id ? { ...t, status: action.status } : t)),
      };
    case 'addComment':
      return {
        ...db,
        tickets: db.tickets.map((t) =>
          t.id === action.ticketId ? { ...t, comments: [...t.comments, action.comment] } : t,
        ),
      };
  }
}
