import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PeriodSwitch } from '@/components/month-switch';
import { PaymentBadge } from '@/components/status';
import { Button, Empty, ListRow, Screen, Stat } from '@/components/ui';
import { addMonths, formatMonth, monthOf } from '@/lib/dates';
import { useToday } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { amountDue, generateMonth, paymentStatus, summarize } from '@/lib/payments';
import { unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function Zahlungen() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const today = useToday();
  const [month, setMonth] = useState(monthOf(today));

  const payments = db.payments
    .filter((p) => p.month === month)
    .sort((a, b) => tenantName(a.tenantId).localeCompare(tenantName(b.tenantId), 'de'));
  const summary = summarize(payments, today);
  const missing = generateMonth(db, month).length;

  function tenantName(id: string) {
    return db.tenants.find((t) => t.id === id)?.name ?? 'Unbekannt';
  }

  return (
    <Screen>
      <PeriodSwitch
        label={formatMonth(month)}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Soll" value={formatEUR(summary.due)} />
        <Stat label="Eingegangen" value={formatEUR(summary.paid)} tone="success" />
        <Stat label="Offen" value={formatEUR(summary.outstanding)} tone={summary.outstanding > 0 ? 'warning' : undefined} />
      </View>

      {missing > 0 ? (
        <Button
          label={`Mieten für ${formatMonth(month)} anlegen (${missing})`}
          icon="add-circle-outline"
          onPress={() => dispatch({ type: 'generateMonth', month })}
        />
      ) : null}

      {payments.length === 0 ? (
        <Empty icon="cash-outline" text={`Für ${formatMonth(month)} gibt es noch keine Mietzahlungen.`} />
      ) : (
        payments.map((p) => (
          <ListRow
            key={p.id}
            title={tenantName(p.tenantId)}
            subtitle={`${unitLabel(db, db.tenants.find((t) => t.id === p.tenantId)?.unitId ?? '')}\n${formatEUR(p.paid)} von ${formatEUR(amountDue(p))}`}
            right={<PaymentBadge status={paymentStatus(p, today)} />}
            onPress={() => router.push(`/zahlung/${p.id}`)}
          />
        ))
      )}
    </Screen>
  );
}
