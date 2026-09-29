import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { PaymentBadge } from '@/components/status';
import { Button, Card, Empty, Field, KeyValue, Screen, SectionHeader, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatDate, formatMonth, parseDate } from '@/lib/dates';
import { useParam, useToday } from '@/lib/hooks';
import { centsToInput, formatEUR, parseEUR } from '@/lib/money';
import { amountDue, outstanding, paymentStatus } from '@/lib/payments';
import { unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function ZahlungDetail() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const today = useToday();
  const id = useParam('id');
  const payment = db.payments.find((p) => p.id === id);
  const tenant = payment && db.tenants.find((t) => t.id === payment.tenantId);

  const [amount, setAmount] = useState(payment ? centsToInput(outstanding(payment)) : '');
  const [date, setDate] = useState(formatDate(today));
  const [submitted, setSubmitted] = useState(false);

  if (!payment || !tenant) {
    return (
      <Screen>
        <Empty text="Diese Zahlung wurde nicht gefunden." />
      </Screen>
    );
  }

  const amountCents = parseEUR(amount);
  const dateISO = parseDate(date);
  const rest = outstanding(payment);
  const status = paymentStatus(payment, today);

  function book() {
    setSubmitted(true);
    if (!payment || amountCents === null || amountCents <= 0 || !dateISO) return;
    dispatch({ type: 'bookPayment', id: payment.id, paid: payment.paid + amountCents, paidOn: dateISO });
    router.back();
  }

  function reset() {
    if (!payment) return;
    dispatch({ type: 'bookPayment', id: payment.id, paid: 0 });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: formatMonth(payment.month) }} />
      <Card>
        <T variant="heading">{tenant.name}</T>
        <T variant="muted">{unitLabel(db, tenant.unitId)}</T>
        <PaymentBadge status={status} />
        <KeyValue label="Kaltmiete" value={formatEUR(payment.rentDue)} />
        <KeyValue label="Nebenkosten-Vorauszahlung" value={formatEUR(payment.utilitiesDue)} />
        <KeyValue label="Soll gesamt" value={formatEUR(amountDue(payment))} strong />
        <KeyValue label="Eingegangen" value={formatEUR(payment.paid)} />
        <KeyValue label="Noch offen" value={formatEUR(rest)} strong tone={rest > 0 ? 'warning' : 'success'} />
        {payment.paidOn ? <KeyValue label="Letzter Eingang" value={formatDate(payment.paidOn)} /> : null}
      </Card>

      {rest > 0 ? (
        <>
          <SectionHeader title="Zahlungseingang erfassen" />
          <Field
            label="Betrag in €"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            error={submitted && (amountCents === null || amountCents <= 0) ? 'Bitte einen Betrag größer 0 eingeben' : undefined}
          />
          <Field
            label="Zahlungsdatum"
            value={date}
            onChangeText={setDate}
            placeholder="TT.MM.JJJJ"
            keyboardType="numbers-and-punctuation"
            error={submitted && !dateISO ? 'Bitte ein gültiges Datum eingeben' : undefined}
          />
          <Button label="Zahlung buchen" icon="checkmark" onPress={book} />
        </>
      ) : null}

      {payment.paid > 0 ? (
        <Button
          label="Zahlungen zurücksetzen"
          variant="danger"
          icon="arrow-undo-outline"
          onPress={() =>
            confirm('Zahlungen zurücksetzen?', 'Alle erfassten Zahlungseingänge dieses Monats werden gelöscht.', 'Zurücksetzen', reset)
          }
        />
      ) : null}
    </Screen>
  );
}
