import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AccountSection } from '@/components/account-section';
import { PaymentBadge, TicketStatusBadge } from '@/components/status';
import { Card, Empty, ListRow, Screen, SectionHeader, Stat, T } from '@/components/ui';
import { formatMonth, monthOf } from '@/lib/dates';
import { useToday } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { outstanding, paymentStatus, summarize } from '@/lib/payments';
import { sortTickets, unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function Dashboard() {
  const { db } = useStore();
  const router = useRouter();
  const today = useToday();
  const month = monthOf(today);

  const summary = summarize(
    db.payments.filter((p) => p.month === month),
    today,
  );
  const overdue = db.payments
    .filter((p) => paymentStatus(p, today) === 'overdue')
    .sort((a, b) => a.month.localeCompare(b.month));
  const overdueTotal = overdue.reduce((sum, p) => sum + outstanding(p), 0);
  const rented = db.units.filter((u) => db.tenants.some((t) => t.unitId === u.id)).length;
  const openTickets = sortTickets(db.tickets).filter((t) => t.status !== 'done');
  const tenantName = (id: string) => db.tenants.find((t) => t.id === id)?.name ?? 'Unbekannt';

  return (
    <Screen>
      <T variant="heading">{formatMonth(month)}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Soll" value={formatEUR(summary.due)} />
        <Stat label="Eingegangen" value={formatEUR(summary.paid)} tone="success" />
        <Stat label="Offen" value={formatEUR(summary.outstanding)} tone={summary.outstanding > 0 ? 'warning' : undefined} />
        <Stat label="Vermietet" value={`${rented} von ${db.units.length}`} />
      </View>

      <SectionHeader title={`Überfällige Zahlungen (${overdue.length})`} />
      {overdue.length === 0 ? (
        <Card>
          <T variant="muted">Keine überfälligen Zahlungen. 🎉</T>
        </Card>
      ) : (
        <>
          <T variant="muted">Rückstand gesamt: {formatEUR(overdueTotal)}</T>
          {overdue.slice(0, 5).map((p) => (
            <ListRow
              key={p.id}
              title={tenantName(p.tenantId)}
              subtitle={`${formatMonth(p.month)} · offen ${formatEUR(outstanding(p))}`}
              right={<PaymentBadge status="overdue" />}
              onPress={() => router.push(`/zahlung/${p.id}`)}
            />
          ))}
          {overdue.length > 5 ? (
            <T variant="muted">… und {overdue.length - 5} weitere im Tab „Zahlungen“.</T>
          ) : null}
        </>
      )}

      <SectionHeader title={`Offene Tickets (${openTickets.length})`} />
      {openTickets.length === 0 ? (
        <Empty icon="checkmark-circle-outline" text="Alle Meldungen sind erledigt." />
      ) : (
        openTickets.slice(0, 4).map((t) => (
          <ListRow
            key={t.id}
            title={t.title}
            subtitle={`${tenantName(t.tenantId)} · ${unitLabel(db, t.unitId)}`}
            right={<TicketStatusBadge status={t.status} />}
            onPress={() => router.push(`/ticket/${t.id}`)}
          />
        ))
      )}

      <AccountSection name="Verwalter" />
    </Screen>
  );
}
