import { Tabs } from 'expo-router';

import { tabIcon } from '@/components/tab-icon';
import { openTicketCount } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme';

export default function VerwalterTabs() {
  const theme = useTheme();
  const { db } = useStore();
  const openTickets = openTicketCount(db.tickets);

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
      <Tabs.Screen name="index" options={{ title: 'Übersicht', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="objekte" options={{ title: 'Objekte', tabBarIcon: tabIcon('business-outline') }} />
      <Tabs.Screen name="zahlungen" options={{ title: 'Zahlungen', tabBarIcon: tabIcon('cash-outline') }} />
      <Tabs.Screen name="nebenkosten" options={{ title: 'Nebenkosten', tabBarIcon: tabIcon('receipt-outline') }} />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          tabBarIcon: tabIcon('construct-outline'),
          tabBarBadge: openTickets > 0 ? openTickets : undefined,
        }}
      />
    </Tabs>
  );
}
