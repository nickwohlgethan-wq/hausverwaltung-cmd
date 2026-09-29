import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/** Meldet Lade- und Speicherfehler oberhalb der Inhalte; Tippen schließt sie. */
export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      accessibilityLabel={`${message} Zum Schließen tippen.`}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: radius.md,
        backgroundColor: theme.dangerSoft,
        borderWidth: 1,
        borderColor: theme.danger,
        maxWidth: 720,
        alignSelf: 'center',
      }}>
      <Ionicons name="warning-outline" size={20} color={theme.danger} />
      <T variant="muted" color={theme.danger} style={{ flex: 1 }}>
        {message}
      </T>
      <Ionicons name="close" size={18} color={theme.danger} />
    </Pressable>
  );
}
