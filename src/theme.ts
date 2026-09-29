import { useColorScheme } from 'react-native';

export type Theme = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  neutralSoft: string;
  isDark: boolean;
};

const light: Theme = {
  bg: '#F3F6F7',
  card: '#FFFFFF',
  text: '#0F1B1E',
  muted: '#5B6B70',
  border: '#DDE4E6',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  primarySoft: '#D5F0EC',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  warning: '#A15C07',
  warningSoft: '#FEF0C7',
  success: '#067647',
  successSoft: '#D1FADF',
  info: '#175CD3',
  infoSoft: '#D1E9FF',
  neutralSoft: '#E8EDEF',
  isDark: false,
};

const dark: Theme = {
  bg: '#0B1214',
  card: '#152024',
  text: '#EAF1F2',
  muted: '#93A4A9',
  border: '#26363B',
  primary: '#2DD4BF',
  onPrimary: '#04201C',
  primarySoft: '#0F3B37',
  danger: '#FDA29B',
  dangerSoft: '#4A1B17',
  warning: '#FEC84B',
  warningSoft: '#40300A',
  success: '#6CE9A6',
  successSoft: '#0B3A26',
  info: '#84CAFF',
  infoSoft: '#12325A',
  neutralSoft: '#22323A',
  isDark: true,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export function toneColors(theme: Theme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: theme.success, bg: theme.successSoft };
    case 'warning':
      return { fg: theme.warning, bg: theme.warningSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'info':
      return { fg: theme.info, bg: theme.infoSoft };
    case 'primary':
      return { fg: theme.primary, bg: theme.primarySoft };
    default:
      return { fg: theme.muted, bg: theme.neutralSoft };
  }
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
