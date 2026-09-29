import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen, T } from '@/components/ui';
import { useTheme } from '@/theme';

/** Gemeinsamer Rahmen der Anmelde-, Registrierungs- und Einladungsseiten. */
export function AuthLayout({
  title,
  subtitle,
  children,
  compact,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Ohne großes Logo (für Seiten mit Navigationsleiste) */
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={compact ? [] : ['top', 'bottom']}>
      <Screen refreshable={false}>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: compact ? 8 : 24 }}>
          {compact ? null : (
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
          )}
          <T variant="title" style={{ textAlign: 'center' }}>
            {title}
          </T>
          {subtitle ? (
            <T variant="muted" style={{ textAlign: 'center' }}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {children}
      </Screen>
    </SafeAreaView>
  );
}
