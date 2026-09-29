import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/** Vor/Zurück-Auswahl für Monat oder Jahr. */
export function PeriodSwitch({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const theme = useTheme();
  const btn = {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Zurück" style={btn}>
        <Ionicons name="chevron-back" size={20} color={theme.text} />
      </Pressable>
      <T variant="heading">{label}</T>
      <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Weiter" style={btn}>
        <Ionicons name="chevron-forward" size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}
