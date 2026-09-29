import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { useStore } from '@/lib/store';

/** Abmelden und Demo-Daten zurücksetzen – am Ende der jeweiligen Übersicht. */
export function AccountSection({ name }: { name: string }) {
  const { signOut, resetDemo } = useStore();
  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <T variant="caption" style={{ textAlign: 'center' }}>
        Angemeldet als {name}
      </T>
      <Button label="Abmelden" variant="secondary" icon="log-out-outline" onPress={signOut} />
      <Button
        label="Demo-Daten zurücksetzen"
        variant="danger"
        icon="refresh-outline"
        onPress={() =>
          confirm(
            'Demo-Daten zurücksetzen?',
            'Alle Änderungen gehen verloren und die Beispieldaten werden neu geladen.',
            'Zurücksetzen',
            resetDemo,
          )
        }
      />
    </View>
  );
}
