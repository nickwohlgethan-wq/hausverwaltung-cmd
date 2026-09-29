import { useRouter } from 'expo-router';

import { AccountSection } from '@/components/account-section';
import { PaymentBadge } from '@/components/status';
import { Button, Card, KeyValue, Screen, SectionHeader, T } from '@/components/ui';
import { dueDateOf, formatDate, formatMonth, monthOf } from '@/lib/dates';
import { useMieter, useToday } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { amountDue, outstanding, paymentStatus } from '@/lib/payments';
import { addressOf, openTicketCount } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme';

export default function MieterUebersicht() {
  const { db } = useStore();
  const router = useRouter();
  const today = useToday();
  const theme = useTheme();
  const mieter = useMieter();
  if (!mieter) return null;
  const { tenant, unit, property } = mieter;

  const current = db.payments.find((p) => p.tenantId === tenant.id && p.month === monthOf(today));
  const openTickets = openTicketCount(db.tickets.filter((t) => t.tenantId === tenant.id));
  const totalOutstanding = db.payments
    .filter((p) => p.tenantId === tenant.id && paymentStatus(p, today) === 'overdue')
    .reduce((sum, p) => sum + outstanding(p), 0);

  return (
    <Screen>
      <T variant="title">Hallo, {tenant.name.split(' ')[0]}</T>

      <Card>
        <T variant="heading">
          {unit.name}
          {unit.floor ? ` (${unit.floor})` : ''}
        </T>
        <T variant="muted">
          {property.name} · {addressOf(property)}
        </T>
        <KeyValue label="Fläche" value={`${unit.areaSqm.toLocaleString('de-DE')} m²`} />
        <KeyValue label="Zimmer" value={unit.rooms.toLocaleString('de-DE')} />
        <KeyValue label="Einzug" value={formatDate(tenant.moveIn)} />
      </Card>

      <SectionHeader title="Miete" />
      <Card>
        <KeyValue label="Kaltmiete" value={formatEUR(unit.baseRent)} />
        <KeyValue label="Nebenkosten-Vorauszahlung" value={formatEUR(unit.utilitiesPrepayment)} />
        <KeyValue label="Gesamtmiete pro Monat" value={formatEUR(unit.baseRent + unit.utilitiesPrepayment)} strong />
      </Card>

      {current ? (
        <Card onPress={() => router.push('/mieter/zahlungen')}>
          <T variant="bodyStrong">{formatMonth(current.month)}</T>
          <PaymentBadge status={paymentStatus(current, today)} />
          <T variant="muted">
            {formatEUR(current.paid)} von {formatEUR(amountDue(current))} bezahlt · fällig am {formatDate(dueDateOf(current.month))}
          </T>
        </Card>
      ) : null}
      {totalOutstanding > 0 ? (
        <Card>
          <T variant="bodyStrong" color={theme.danger}>
            Offener Rückstand: {formatEUR(totalOutstanding)}
          </T>
          <T variant="muted">Bitte überweise den offenen Betrag. Details findest du unter „Miete“.</T>
        </Card>
      ) : null}

      <SectionHeader title="Reparaturen" />
      <Card>
        <T variant="muted">
          {openTickets === 0 ? 'Du hast keine offenen Meldungen.' : `Du hast ${openTickets} offene Meldung${openTickets === 1 ? '' : 'en'}.`}
        </T>
        <Button label="Schaden melden" icon="construct-outline" onPress={() => router.push('/ticket/neu')} />
      </Card>

      <AccountSection name={tenant.name} />
    </Screen>
  );
}
