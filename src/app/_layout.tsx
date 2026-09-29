import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FullScreenMessage } from '@/components/full-screen-message';
import { Button, T } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StoreProvider, useStore } from '@/lib/store';
import { isConfigured } from '@/lib/supabase';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserScopedStore>
        <RootNavigator />
      </UserScopedStore>
    </AuthProvider>
  );
}

/** Der Store (Daten, Navigationsstand) wird für jedes Konto neu aufgebaut. */
function UserScopedStore({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <StoreProvider key={user?.id ?? 'abgemeldet'}>{children}</StoreProvider>;
}

function RootNavigator() {
  const auth = useAuth();
  const { ready, session, needsInvite, loadFailed, refresh, signOut, error, clearError } = useStore();
  const theme = useTheme();

  const booting = isConfigured && (!auth.ready || !ready);
  useEffect(() => {
    if (!booting) SplashScreen.hideAsync();
  }, [booting]);

  if (booting) return null;

  if (!isConfigured) {
    return (
      <FullScreenMessage icon="construct-outline" title="Backend nicht eingerichtet">
        <T variant="muted" style={{ textAlign: 'center' }}>
          Trage EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY in die Datei .env ein
          (Vorlage: .env.example) und starte die App mit „npx expo start -c“ neu. Die Schritte stehen in der README.
        </T>
      </FullScreenMessage>
    );
  }

  if (auth.profileFailed) {
    return (
      <FullScreenMessage
        title="Konto konnte nicht geladen werden"
        actions={
          <View style={{ gap: 8 }}>
            <Button label="Erneut versuchen" icon="refresh-outline" onPress={auth.retryProfile} />
            <Button label="Abmelden" variant="secondary" onPress={auth.signOut} />
          </View>
        }>
        <T variant="muted" style={{ textAlign: 'center' }}>
          Bitte prüfe deine Verbindung.
        </T>
      </FullScreenMessage>
    );
  }

  if (loadFailed) {
    return (
      <FullScreenMessage
        title="Daten konnten nicht geladen werden"
        actions={
          <View style={{ gap: 8 }}>
            <Button label="Erneut versuchen" icon="refresh-outline" onPress={refresh} />
            <Button label="Abmelden" variant="secondary" onPress={signOut} />
          </View>
        }>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {error ?? 'Bitte prüfe deine Verbindung.'}
        </T>
      </FullScreenMessage>
    );
  }

  const signedIn = !!auth.user;
  const isVerwalter = session?.role === 'verwalter';
  const isMieter = session?.role === 'mieter';
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: theme.primary, background: theme.bg, card: theme.card, text: theme.text, border: theme.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerBackTitle: 'Zurück', contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="registrieren" options={{ title: 'Registrieren' }} />
            <Stack.Screen name="bestaetigen" options={{ title: 'E-Mail bestätigen' }} />
            <Stack.Screen name="passwort-vergessen" options={{ title: 'Passwort vergessen' }} />
          </Stack.Protected>

          <Stack.Protected guard={signedIn && needsInvite}>
            <Stack.Screen name="einladung" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={isVerwalter}>
            <Stack.Screen name="verwalter" options={{ headerShown: false }} />
            <Stack.Screen name="objekt/[id]" options={{ title: 'Objekt' }} />
            <Stack.Screen name="objekt/formular" options={{ title: 'Objekt', presentation: 'modal' }} />
            <Stack.Screen name="wohnung/[id]" options={{ title: 'Wohnung' }} />
            <Stack.Screen name="wohnung/formular" options={{ title: 'Wohnung', presentation: 'modal' }} />
            <Stack.Screen name="mietvertrag/formular" options={{ title: 'Mieter', presentation: 'modal' }} />
            <Stack.Screen name="zahlung/[id]" options={{ title: 'Zahlung' }} />
            <Stack.Screen name="kosten/formular" options={{ title: 'Kostenposition', presentation: 'modal' }} />
          </Stack.Protected>

          <Stack.Protected guard={isMieter}>
            <Stack.Screen name="mieter" options={{ headerShown: false }} />
            <Stack.Screen name="ticket/neu" options={{ title: 'Schaden melden', presentation: 'modal' }} />
          </Stack.Protected>

          <Stack.Protected guard={!!session}>
            <Stack.Screen name="ticket/[id]" options={{ title: 'Ticket' }} />
            <Stack.Screen name="abrechnung/[tenantId]" options={{ title: 'Nebenkostenabrechnung' }} />
          </Stack.Protected>
        </Stack>
        <ErrorBanner message={error} onDismiss={clearError} />
      </View>
    </ThemeProvider>
  );
}
