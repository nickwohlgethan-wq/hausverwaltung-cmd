import { Badge } from '@/components/ui';
import { PAYMENT_STATUS_LABEL, PRIORITY_LABEL, TICKET_STATUS_LABEL } from '@/lib/labels';
import type { PaymentStatus, TicketPriority, TicketStatus } from '@/lib/types';
import type { Tone } from '@/theme';

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  paid: 'success',
  partial: 'warning',
  open: 'info',
  overdue: 'danger',
};

const TICKET_TONE: Record<TicketStatus, Tone> = {
  open: 'danger',
  in_progress: 'warning',
  done: 'success',
};

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  low: 'neutral',
  normal: 'info',
  urgent: 'danger',
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge label={PAYMENT_STATUS_LABEL[status]} tone={PAYMENT_TONE[status]} />;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge label={TICKET_STATUS_LABEL[status]} tone={TICKET_TONE[status]} />;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge label={PRIORITY_LABEL[priority]} tone={PRIORITY_TONE[priority]} />;
}
