import { PaymentBadge } from '@/components/status';
import { Card, Empty, KeyValue, Screen, T } from '@/components/ui';
import { dueDateOf, formatDate, formatMonth } from '@/lib/dates';
import { useMieter, useToday } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { amountDue, outstanding, paymentStatus } from '@/lib/payments';
import { useStore } from '@/lib/store';

export default function MieterZahlungen() {
  const { db } = useStore();
  const today = useToday();
  const mieter = useMieter();
  if (!mieter) return null;

  const payments = db.payments
    .filter((p) => p.tenantId === mieter.tenant.id)
    .sort((a, b) => b.month.localeCompare(a.month));

  if (payments.length === 0) {
    return (
      <Screen>
        <Empty icon="cash-outline" text="Noch keine Mietzahlungen vorhanden." />
      </Screen>
    );
  }

  return (
    <Screen>
      {payments.map((p) => {
        const status = paymentStatus(p, today);
        return (
          <Card key={p.id}>
            <T variant="bodyStrong">{formatMonth(p.month)}</T>
            <PaymentBadge status={status} />
            <KeyValue label="Kaltmiete" value={formatEUR(p.rentDue)} />
            <KeyValue label="Nebenkosten-Vorauszahlung" value={formatEUR(p.utilitiesDue)} />
            <KeyValue label="Gesamt" value={formatEUR(amountDue(p))} strong />
            <KeyValue label="Bezahlt" value={formatEUR(p.paid)} />
            {outstanding(p) > 0 ? (
              <KeyValue
                label={`Offen (fällig ${formatDate(dueDateOf(p.month))})`}
                value={formatEUR(outstanding(p))}
                strong
                tone={status === 'overdue' ? 'danger' : 'warning'}
              />
            ) : p.paidOn ? (
              <KeyValue label="Eingang" value={formatDate(p.paidOn)} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
