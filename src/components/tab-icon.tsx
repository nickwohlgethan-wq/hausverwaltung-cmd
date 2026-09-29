import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Erzeugt die `tabBarIcon`-Funktion für ein Ionicons-Symbol. */
export function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}
