import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen, T } from '@/components/ui';
import { useTheme } from '@/theme';

/** Vollbild-Hinweis für Zustände, in denen die App nicht weiterarbeiten kann. */
export function FullScreenMessage({
  icon = 'alert-circle-outline',
  title,
  children,
  actions,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Screen refreshable={false}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <Ionicons name={icon} size={48} color={theme.muted} />
          <T variant="title" style={{ textAlign: 'center' }}>
            {title}
          </T>
          {children}
        </View>
        {actions}
      </Screen>
    </SafeAreaView>
  );
}
