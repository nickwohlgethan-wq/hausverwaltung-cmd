import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, ListRow, Screen, SectionHeader, T } from '@/components/ui';
import { unitLabel } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme';

export default function Login() {
  const { db, signIn } = useStore();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="business" size={38} color={theme.onPrimary} />
          </View>
          <T variant="title">Hausverwaltung</T>
          <T variant="muted" style={{ textAlign: 'center' }}>
            Objekte, Mieten, Nebenkosten und Reparaturen an einem Ort.
          </T>
        </View>

        <Card>
          <T variant="heading">Für Verwalter</T>
          <T variant="muted">Alle Objekte, Zahlungen, Abrechnungen und Tickets verwalten.</T>
          <View style={{ height: 8 }} />
          <Button label="Als Verwalter anmelden" icon="briefcase-outline" onPress={() => signIn({ role: 'verwalter' })} />
        </Card>

        <SectionHeader title="Für Mieter" />
        {db.tenants.map((t) => (
          <ListRow
            key={t.id}
            title={t.name}
            subtitle={unitLabel(db, t.unitId)}
            onPress={() => signIn({ role: 'mieter', tenantId: t.id })}
          />
        ))}

        <T variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
          Demo-Anmeldung ohne Passwort. Alle Daten liegen nur lokal auf diesem Gerät.
        </T>
      </Screen>
    </SafeAreaView>
  );
}
