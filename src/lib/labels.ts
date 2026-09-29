import type { PaymentStatus, TicketPriority, TicketStatus } from './types';

export const TICKET_CATEGORIES = [
  'Heizung',
  'Wasser/Sanitär',
  'Elektrik',
  'Fenster/Türen',
  'Schimmel/Feuchtigkeit',
  'Sonstiges',
] as const;

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
};

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'done'];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  urgent: 'Dringend',
};

export const PRIORITIES: TicketPriority[] = ['low', 'normal', 'urgent'];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: 'Bezahlt',
  partial: 'Teilweise bezahlt',
  open: 'Offen',
  overdue: 'Überfällig',
};
