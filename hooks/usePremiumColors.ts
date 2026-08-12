import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { PREMIUM_GOLD, PREMIUM_BLUE } from '@/constants/layout';

/**
 * Dynamic premium palette for Light/Dark.
 * Gold accent is preserved in both modes.
 */
export type PremiumColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  border: string;
  glass: string;
  glassStrong: string;
  gold: string;
  blue: string;
  blurTint: 'dark' | 'light';
  bubbleMine: string;
  bubbleMineText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  danger: string;
  isDark: boolean;
};

export function getPremiumColors(isDark: boolean): PremiumColors {
  if (isDark) {
    return {
      bg: '#0A0F1A',
      surface: '#111827',
      surfaceAlt: '#161B22',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      muted: '#64748B',
      border: 'rgba(255,255,255,0.1)',
      glass: 'rgba(10, 15, 26, 0.85)',
      glassStrong: 'rgba(17, 24, 39, 0.92)',
      gold: PREMIUM_GOLD,
      blue: PREMIUM_BLUE,
      blurTint: 'dark',
      bubbleMine: PREMIUM_GOLD,
      bubbleMineText: '#0A0F1A',
      bubbleOther: 'rgba(255,255,255,0.1)',
      bubbleOtherText: '#F8FAFC',
      danger: '#F87171',
      isDark: true,
    };
  }

  return {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    muted: '#94A3B8',
    border: 'rgba(15,23,42,0.08)',
    glass: 'rgba(248, 250, 252, 0.88)',
    glassStrong: 'rgba(255, 255, 255, 0.92)',
    gold: PREMIUM_GOLD,
    blue: PREMIUM_BLUE,
    blurTint: 'light',
    bubbleMine: PREMIUM_BLUE,
    bubbleMineText: '#FFFFFF',
    bubbleOther: 'rgba(15,23,42,0.06)',
    bubbleOtherText: '#0F172A',
    danger: '#DC2626',
    isDark: false,
  };
}

export function usePremiumColors(): PremiumColors {
  const { isDark } = useTheme();
  return useMemo(() => getPremiumColors(isDark), [isDark]);
}
