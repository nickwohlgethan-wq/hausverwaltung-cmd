import { Tabs } from 'expo-router';

import { tabIcon } from '@/components/tab-icon';
import { useTheme } from '@/theme';

export default function MieterTabs() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Meine Wohnung', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="zahlungen" options={{ title: 'Miete', tabBarIcon: tabIcon('cash-outline') }} />
      <Tabs.Screen name="nebenkosten" options={{ title: 'Nebenkosten', tabBarIcon: tabIcon('receipt-outline') }} />
      <Tabs.Screen name="tickets" options={{ title: 'Meldungen', tabBarIcon: tabIcon('construct-outline') }} />
    </Tabs>
  );
}
