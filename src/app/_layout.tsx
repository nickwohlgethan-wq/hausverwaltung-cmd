import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { StoreProvider, useStore } from '@/lib/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <StoreProvider>
      <RootNavigator />
    </StoreProvider>
  );
}

function RootNavigator() {
  const { ready, session } = useStore();
  const theme = useTheme();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const isVerwalter = session?.role === 'verwalter';
  const isMieter = session?.role === 'mieter';
  const navTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme : DefaultTheme).colors,
      primary: theme.primary,
      background: theme.bg,
      card: theme.card,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackTitle: 'Zurück', contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
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
    </ThemeProvider>
  );
}
