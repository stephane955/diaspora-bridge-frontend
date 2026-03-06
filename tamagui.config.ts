/**
 * Tamagui configuration — Diaspora Bridge
 * Maps theme.ts tokens: Electric Blue (#0EA5E9), Emerald (#10B981), Midnight Slate (#0B0E14).
 * Glassmorphism blurs and radii for Reanimated headers.
 */

import { createTamagui, createTokens } from 'tamagui';
import { shorthands } from '@tamagui/shorthands';
import { themes, tokens as defaultTokens } from '@tamagui/themes';

const customTokens = createTokens({
  color: {
    ...defaultTokens.color,
    primary: '#0F172A',
    primarySoft: '#1E293B',
    active: '#0EA5E9',
    activeSoft: '#38BDF8',
    emerald: '#10B981',
    emeraldSoft: '#34D399',
    midnightSlate: '#0B0E14',
    midnightSlateSoft: '#161B22',
    background: '#F8FAFC',
    backgroundDark: '#0B0E14',
    surface: '#FFFFFF',
    surfaceDark: '#161B22',
    text: '#0F172A',
    textMuted: '#64748B',
    textDark: '#F1F5F9',
    border: '#E2E8F0',
    borderDark: '#1E293B',
    glass: 'rgba(255,255,255,0.65)',
    glassBright: 'rgba(255,255,255,0.85)',
    glassDark: 'rgba(15,23,42,0.7)',
    glassDarkMode: 'rgba(22,27,34,0.8)',
    glassDarkModeBright: 'rgba(22,27,34,0.9)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  space: {
    ...defaultTokens.space,
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  size: {
    ...defaultTokens.size,
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  radius: {
    ...defaultTokens.radius,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 32,
    pill: 999,
    glass: 20,
    glassLg: 28,
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
    card: 20,
    header: 28,
    pill: 999,
  },
};

const lightTheme = {
  ...themes.light,
  primary: '#0F172A',
  primarySoft: '#1E293B',
  active: '#0EA5E9',
  activeSoft: '#38BDF8',
  emerald: '#10B981',
  emeraldSoft: '#34D399',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  glass: 'rgba(255,255,255,0.65)',
  glassBright: 'rgba(255,255,255,0.85)',
  glassDark: 'rgba(15,23,42,0.7)',
};

const darkTheme = {
  ...themes.dark,
  primary: '#0B0E14',
  primarySoft: '#161B22',
  active: '#0EA5E9',
  activeSoft: '#38BDF8',
  emerald: '#10B981',
  emeraldSoft: '#34D399',
  background: '#0B0E14',
  surface: '#161B22',
  surfaceAlt: '#161B22',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#1E293B',
  glass: 'rgba(22,27,34,0.8)',
  glassBright: 'rgba(22,27,34,0.9)',
  glassDark: 'rgba(11,14,20,0.85)',
};

export const tamaguiConfig = createTamagui({
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
