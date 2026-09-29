import { Platform, Share } from 'react-native';

/**
 * Teilt einen Text über das System-Menü. Wo es das nicht gibt (z. B. manche Browser), wird der Text
 * in die Zwischenablage kopiert. Rückgabe: 'shared', 'copied' oder 'failed'.
 */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message });
      return 'shared';
    }
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      await nav.share({ text: message });
      return 'shared';
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(message);
      return 'copied';
    }
  } catch {
    // Abgebrochen oder nicht erlaubt: unten auf „failed“ fallen.
  }
  return 'failed';
}
