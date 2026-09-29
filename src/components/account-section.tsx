import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

/** Angemeldetes Konto und Abmelden – am Ende der jeweiligen Übersicht. */
export function AccountSection() {
  const { user } = useAuth();
  const { profile, signOut } = useStore();
  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <T variant="caption" style={{ textAlign: 'center' }}>
        Angemeldet als {profile?.displayName}
        {user?.email ? ` (${user.email})` : ''}
      </T>
      <Button label="Abmelden" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </View>
  );
}
