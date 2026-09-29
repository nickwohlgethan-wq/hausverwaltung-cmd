import { Stack, useRouter } from 'expo-router';

import { Badge, Button, Card, Empty, KeyValue, ListRow, Screen, SectionHeader, T } from '@/components/ui';
import { useParam } from '@/lib/hooks';
import { formatEUR } from '@/lib/money';
import { addressOf, tenantOfUnit, unitTitle, unitsOf } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function ObjektDetail() {
  const { db } = useStore();
  const router = useRouter();
  const id = useParam('id');
  const property = db.properties.find((p) => p.id === id);

  if (!property) {
    return (
      <Screen>
        <Empty text="Dieses Objekt wurde nicht gefunden." />
      </Screen>
    );
  }

  const units = unitsOf(db, property.id);
  const totalArea = units.reduce((sum, u) => sum + u.areaSqm, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: property.name }} />
      <Card>
        <T variant="heading">{property.name}</T>
        <T variant="muted">{addressOf(property)}</T>
        <KeyValue label="Wohnungen" value={String(units.length)} />
        <KeyValue label="Gesamtfläche" value={`${totalArea.toLocaleString('de-DE')} m²`} />
      </Card>
      <Button
        label="Objekt bearbeiten"
        variant="secondary"
        icon="create-outline"
        onPress={() => router.push(`/objekt/formular?id=${property.id}`)}
      />

      <SectionHeader
        title="Wohnungen"
        action={{
          label: 'Neu',
          icon: 'add-circle-outline',
          onPress: () => router.push(`/wohnung/formular?propertyId=${property.id}`),
        }}
      />
      {units.length === 0 ? (
        <Empty icon="home-outline" text="Noch keine Wohnungen in diesem Objekt." />
      ) : (
        units.map((u) => {
          const tenant = tenantOfUnit(db, u.id);
          return (
            <ListRow
              key={u.id}
              title={unitTitle(u)}
              subtitle={`${tenant ? tenant.name : 'Leerstand'} · ${u.areaSqm.toLocaleString('de-DE')} m² · ${formatEUR(u.baseRent)}`}
              right={tenant ? undefined : <Badge label="Leer" tone="warning" />}
              onPress={() => router.push(`/wohnung/${u.id}`)}
            />
          );
        })
      )}
    </Screen>
  );
}
