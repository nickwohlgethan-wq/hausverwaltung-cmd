import { useRouter } from 'expo-router';

import { Empty, ListRow, Screen, SectionHeader, T } from '@/components/ui';
import { addressOf, unitsOf } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function Objekte() {
  const { db } = useStore();
  const router = useRouter();

  return (
    <Screen>
      <SectionHeader
        title={`${db.properties.length} Objekte`}
        action={{ label: 'Neu', icon: 'add-circle-outline', onPress: () => router.push('/objekt/formular') }}
      />
      {db.properties.length === 0 ? (
        <Empty icon="business-outline" text="Noch keine Objekte. Lege dein erstes Objekt an." />
      ) : (
        db.properties.map((p) => {
          const units = unitsOf(db, p.id);
          const vacant = units.filter((u) => !db.tenants.some((t) => t.unitId === u.id)).length;
          return (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${addressOf(p)}\n${units.length} Wohnungen${vacant ? ` · ${vacant} leer` : ''}`}
              onPress={() => router.push(`/objekt/${p.id}`)}
            />
          );
        })
      )}
      <T variant="caption">Tippe auf ein Objekt, um Wohnungen und Mieter zu verwalten.</T>
    </Screen>
  );
}
