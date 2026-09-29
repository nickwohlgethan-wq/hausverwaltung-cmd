import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PeriodSwitch } from '@/components/month-switch';
import { Card, Empty, KeyValue, ListRow, Screen, Segmented, SectionHeader, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatEUR } from '@/lib/money';
import { unitLabel, unitsOf } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { ALLOCATION_LABEL, computeStatement } from '@/lib/utilities';
import { useTheme } from '@/theme';

export default function Nebenkosten() {
  const { db, dispatch } = useStore();
  const router = useRouter();
  const theme = useTheme();
  // Abgerechnet wird üblicherweise das Vorjahr.
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [pickedProperty, setPickedProperty] = useState<string | undefined>();

  const propertyId = db.properties.some((p) => p.id === pickedProperty)
    ? pickedProperty
    : db.properties[0]?.id;

  if (!propertyId) {
    return (
      <Screen>
        <Empty icon="business-outline" text="Lege zuerst ein Objekt an, um Nebenkosten zu erfassen." />
      </Screen>
    );
  }

  const costs = db.costs.filter((c) => c.propertyId === propertyId && c.year === year);
  const total = costs.reduce((sum, c) => sum + c.amount, 0);
  const tenants = unitsOf(db, propertyId)
    .map((u) => db.tenants.find((t) => t.unitId === u.id))
    .filter((t) => t !== undefined);

  return (
    <Screen>
      <Segmented
        label="Objekt"
        options={db.properties.map((p) => ({ value: p.id, label: p.name }))}
        value={propertyId}
        onChange={setPickedProperty}
      />
      <PeriodSwitch label={`Abrechnungsjahr ${year}`} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} />

      <SectionHeader
        title="Kosten"
        action={{
          label: 'Hinzufügen',
          icon: 'add-circle-outline',
          onPress: () => router.push(`/kosten/formular?propertyId=${propertyId}&year=${year}`),
        }}
      />
      {costs.length === 0 ? (
        <Empty icon="receipt-outline" text={`Für ${year} sind noch keine Kosten erfasst.`} />
      ) : (
        <Card>
          {costs.map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{c.category}</T>
                <T variant="caption">{ALLOCATION_LABEL[c.key]}</T>
              </View>
              <T variant="bodyStrong">{formatEUR(c.amount)}</T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.category} löschen`}
                hitSlop={8}
                onPress={() =>
                  confirm('Position löschen?', `${c.category} (${formatEUR(c.amount)}) wird entfernt.`, 'Löschen', () =>
                    dispatch({ type: 'deleteCost', id: c.id }),
                  )
                }>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </Pressable>
            </View>
          ))}
          <KeyValue label="Summe" value={formatEUR(total)} strong />
        </Card>
      )}

      <SectionHeader title="Abrechnungen" />
      {tenants.length === 0 ? (
        <Empty icon="people-outline" text="In diesem Objekt gibt es noch keine Mieter." />
      ) : (
        tenants.map((t) => {
          const s = computeStatement(db, t, year);
          const hasData = s !== null && s.lines.length > 0 && s.months > 0;
          const subtitle = !hasData
            ? 'Keine Abrechnung möglich'
            : s.balance > 0
              ? `Nachzahlung ${formatEUR(s.balance)}`
              : s.balance < 0
                ? `Guthaben ${formatEUR(-s.balance)}`
                : 'Ausgeglichen';
          return (
            <ListRow
              key={t.id}
              title={t.name}
              subtitle={`${unitLabel(db, t.unitId)}\n${subtitle}`}
              onPress={() => router.push(`/abrechnung/${t.id}?year=${year}`)}
            />
          );
        })
      )}
    </Screen>
  );
}
