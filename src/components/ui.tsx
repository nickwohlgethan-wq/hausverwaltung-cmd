import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { radius, space, toneColors, useTheme, type Tone } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MAX_WIDTH = 720;

/** Scrollbarer Bildschirm mit einheitlichem Innenabstand; auf breiten Displays zentriert. */
export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const inner = [styles.screenInner, style];
  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.bg }]}>
        <View style={inner}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.bg }]}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'bodyStrong' | 'muted' | 'caption';

export function T({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const theme = useTheme();
  return (
    <Text
      {...rest}
      style={[
        textStyles[variant],
        { color: color ?? (variant === 'muted' || variant === 'caption' ? theme.muted : theme.text) },
        style,
      ]}
    />
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const fg =
    variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.primary;
  const bg =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.dangerSoft : theme.primarySoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <T variant="caption" style={styles.fieldLabel}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        {...rest}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: error ? theme.danger : theme.border,
          },
          rest.multiline && styles.inputMultiline,
          style,
        ]}
      />
      {error ? (
        <T variant="caption" color={theme.danger}>
          {error}
        </T>
      ) : hint ? (
        <T variant="caption">{hint}</T>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme, tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Auswahl aus wenigen Optionen (z. B. Objekt, Jahr, Status). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <T variant="caption" style={styles.fieldLabel}>
          {label}
        </T>
      ) : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.primary : theme.card,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}>
              <Text
                style={[styles.chipLabel, { color: selected ? theme.onPrimary : theme.text }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <T variant="heading">{title}</T>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={styles.sectionAction}
          hitSlop={8}>
          {action.icon ? <Ionicons name={action.icon} size={18} color={theme.primary} /> : null}
          <Text style={[styles.sectionActionLabel, { color: theme.primary }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color={theme.muted} />
      <T variant="muted" style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}

export function KeyValue({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: Tone;
}) {
  const theme = useTheme();
  return (
    <View style={styles.kv}>
      <T variant="muted" style={styles.kvLabel}>
        {label}
      </T>
      <T
        variant={strong ? 'bodyStrong' : 'body'}
        color={tone ? toneColors(theme, tone).fg : undefined}
        style={styles.kvValue}>
        {value}
      </T>
    </View>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const theme = useTheme();
  return (
    <Card style={styles.stat}>
      <T variant="caption">{label}</T>
      <T variant="heading" color={tone ? toneColors(theme, tone).fg : undefined}>
        {value}
      </T>
    </Card>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** Zeile mit Titel, Untertitel und Chevron – für Listen, die weiter navigieren. */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title}>
      <View style={styles.listRow}>
        <View style={styles.flex}>
          <T variant="bodyStrong">{title}</T>
          {subtitle ? <T variant="muted">{subtitle}</T> : null}
        </View>
        {right}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.muted} /> : null}
      </View>
    </Card>
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  muted: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenInner: {
    padding: space.lg,
    gap: space.md,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingBottom: space.xl * 2,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.xs,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  field: { gap: space.xs },
  fieldLabel: { fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeLabel: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 14, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sectionActionLabel: { fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 2 },
  kvLabel: { flexShrink: 1 },
  kvValue: { textAlign: 'right', flexShrink: 1 },
  stat: { flex: 1, minWidth: 140 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
