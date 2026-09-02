/**
 * Tamagui configuration — Diaspora Bridge
 *
 * Mirrors `constants/design.ts`: gold accent (#D4AF37), emerald success
 * (#34D399), midnight canvas (#0A0F1A). Keep these in sync with the design
 * tokens — Tamagui surfaces sit next to StyleSheet surfaces on the same screen.
 */

import { createTamagui, createTokens } from 'tamagui';
import { createAnimations } from '@tamagui/animations-react-native';
import { shorthands } from '@tamagui/shorthands';
import { themes, tokens as defaultTokens } from '@tamagui/themes';
import {
  DANGER,
  GOLD,
  GOLD_DEEP,
  NAVY,
  NAVY_SOFT,
  radius,
  space,
  SUCCESS,
  SUCCESS_DEEP,
  WARNING,
} from './constants/design';

const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 15,
    stiffness: 120,
    mass: 1,
  },
  slow: {
    type: 'spring',
    damping: 15,
    stiffness: 40,
  },
  tooltip: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
});

const customTokens = createTokens({
  color: {
    ...defaultTokens.color,
    primary: NAVY,
    primarySoft: NAVY_SOFT,
    active: GOLD,
    activeSoft: GOLD_DEEP,
    emerald: SUCCESS,
    emeraldSoft: SUCCESS_DEEP,
    midnightSlate: '#0A0F1A',
    midnightSlateSoft: '#111827',
    background: '#F8FAFC',
    backgroundDark: '#0A0F1A',
    surface: '#FFFFFF',
    surfaceDark: '#111827',
    text: NAVY,
    textMuted: '#64748B',
    textDark: '#F8FAFC',
    border: '#E2E8F0',
    borderDark: 'rgba(255,255,255,0.1)',
    glass: 'rgba(255,255,255,0.65)',
    glassBright: 'rgba(255,255,255,0.85)',
    glassDark: 'rgba(15,23,42,0.7)',
    glassDarkMode: 'rgba(10,15,26,0.85)',
    glassDarkModeBright: 'rgba(17,24,39,0.92)',
    success: SUCCESS,
    warning: WARNING,
    danger: DANGER,
  },
  space: {
    ...defaultTokens.space,
    xs: space.xs,
    sm: space.sm,
    md: space.md,
    lg: space.lg,
    xl: space.xl,
    xxl: space.xxl,
  },
  size: {
    ...defaultTokens.size,
    xs: space.xs,
    sm: space.sm,
    md: space.md,
    lg: space.lg,
    xl: space.xl,
    xxl: space.xxl,
  },
  radius: {
    ...defaultTokens.radius,
    xs: radius.sm,
    sm: radius.md,
    md: radius.lg,
    lg: radius.xl,
    xl: radius.xxl,
    pill: radius.pill,
    glass: radius.xl,
    glassLg: radius.xxl,
  },
  zIndex: {
    ...defaultTokens.zIndex,
  },
});

const glassmorphism = {
  blur: {
    light: 30,
    medium: 60,
    strong: 80,
    header: 80,
  },
  radius: {
    card: radius.lg,
    header: radius.xxl,
    pill: radius.pill,
  },
};

const lightTheme = {
  ...themes.light,
  primary: NAVY,
  primarySoft: NAVY_SOFT,
  active: GOLD,
  activeSoft: GOLD_DEEP,
  emerald: SUCCESS,
  emeraldSoft: SUCCESS_DEEP,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  text: NAVY,
  textMuted: '#64748B',
  border: '#E2E8F0',
  glass: 'rgba(255,255,255,0.65)',
  glassBright: 'rgba(255,255,255,0.85)',
  glassDark: 'rgba(15,23,42,0.7)',
};

// Matches usePremiumColors() dark exactly, so Tamagui and StyleSheet surfaces
// cannot render two different dark backgrounds on the same screen.
const darkTheme = {
  ...themes.dark,
  primary: '#0A0F1A',
  primarySoft: '#111827',
  active: GOLD,
  activeSoft: GOLD_DEEP,
  emerald: SUCCESS,
  emeraldSoft: SUCCESS_DEEP,
  background: '#0A0F1A',
  surface: '#111827',
  surfaceAlt: '#161B22',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
  glass: 'rgba(10,15,26,0.85)',
  glassBright: 'rgba(17,24,39,0.92)',
  glassDark: 'rgba(10,15,26,0.85)',
};

export const tamaguiConfig = createTamagui({
  animations,
  tokens: customTokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  shorthands,
  media: {
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  },
});

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export const glassmorphismTokens = glassmorphism;
