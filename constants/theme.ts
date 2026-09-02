/**
 * Light/dark palette consumed by `useTheme()` and by the screens that still
 * import the static `theme` object.
 *
 * Every value here is derived from `constants/design.ts` so the two systems
 * cannot drift apart. In particular `colors.active` is the gold brand accent —
 * it used to be sky blue, which is why screens using `theme` looked off-brand
 * next to screens using `usePremiumColors()`.
 */
import {
    DANGER,
    GOLD,
    GOLD_DEEP,
    NAVY,
    NAVY_SOFT,
    radius,
    shadow,
    space,
    SUCCESS,
    SUCCESS_DEEP,
    WARNING,
    glow,
    weight,
} from './design';

/** Single palette shape used for light and dark */
export type ThemePalette = {
    colors: {
        primary: string;
        primarySoft: string;
        active: string;
        activeSoft: string;
        emerald: string;
        emeraldSoft: string;
        background: string;
        surfaceAlt: string;
        surface: string;
        text: string;
        textMuted: string;
        textSubtle: string;
        success: string;
        warning: string;
        danger: string;
        border: string;
        glass: string;
        glassBright: string;
        glassDark: string;
    };
    gradient: {
        screen: readonly [string, string, ...string[]];
        hero: readonly [string, string];
        active: readonly [string, string];
        emerald: readonly [string, string];
        mesh: readonly [string, string, string];
    };
    radii: { xs: number; sm: number; md: number; lg: number; xl: number; pill: number };
    spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
    shadow: {
        soft: object;
        glow: object;
        glowEmerald: object;
    };
    typography: {
        title: object;
        subtitle: object;
        body: object;
        label: object;
    };
    font: { display: string; body: string };
};

export type ThemeMode = 'light' | 'dark' | 'system';

/** Geometry and elevation are identical in both modes. */
const shared = {
    // Mapped onto the design radius scale (8 / 12 / 16 / 20 / 28 / pill).
    radii: {
        xs: radius.sm,
        sm: radius.md,
        md: radius.lg,
        lg: radius.xl,
        xl: radius.xxl,
        pill: radius.pill,
    },
    // Mapped onto the design 4pt spacing grid.
    spacing: {
        xs: space.xs,
        sm: space.sm,
        md: space.md,
        lg: space.lg,
        xl: space.xl,
        xxl: space.xxl,
    },
    shadow: {
        soft: shadow.card,
        glow: glow(GOLD),
        glowEmerald: glow(SUCCESS),
    },
    typography: {
        title: { fontWeight: weight.heavy, letterSpacing: -0.5 },
        subtitle: { fontWeight: weight.semibold },
        body: { fontWeight: weight.semibold },
        label: {
            fontWeight: weight.heavy,
            letterSpacing: 0.8,
            textTransform: 'uppercase' as const,
        },
    },
    // No custom font is bundled; both keys resolve to the platform system font.
    font: { display: 'System', body: 'System' },
};

const lightPalette: ThemePalette = {
    colors: {
        primary: NAVY,
        primarySoft: NAVY_SOFT,
        active: GOLD,
        activeSoft: GOLD_DEEP,
        emerald: SUCCESS,
        emeraldSoft: SUCCESS_DEEP,
        background: '#F8FAFC',
        surfaceAlt: '#F1F5F9',
        surface: '#FFFFFF',
        text: NAVY,
        textMuted: '#64748B',
        textSubtle: '#94A3B8',
        success: SUCCESS,
        warning: WARNING,
        danger: DANGER,
        border: '#E2E8F0',
        glass: 'rgba(255,255,255,0.65)',
        glassBright: 'rgba(255,255,255,0.85)',
        glassDark: 'rgba(15,23,42,0.7)',
    },
    gradient: {
        screen: ['#F8FAFC', '#F1F5F9', '#FFFFFF'],
        hero: [NAVY, NAVY_SOFT],
        active: [GOLD, GOLD_DEEP],
        emerald: [SUCCESS, SUCCESS_DEEP],
        mesh: [GOLD, GOLD_DEEP, NAVY],
    },
    ...shared,
};

/** Deep Midnight — dark mode palette. Matches `usePremiumColors()` exactly. */
const darkPalette: ThemePalette = {
    ...lightPalette,
    colors: {
        ...lightPalette.colors,
        primary: '#0A0F1A',
        primarySoft: '#111827',
        background: '#0A0F1A',
        surfaceAlt: '#161B22',
        surface: '#111827',
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        textSubtle: '#64748B',
        border: 'rgba(255,255,255,0.1)',
        glass: 'rgba(10,15,26,0.85)',
        glassBright: 'rgba(17,24,39,0.92)',
        glassDark: 'rgba(10,15,26,0.85)',
    },
    gradient: {
        screen: ['#0A0F1A', '#111827', '#0A0F1A'],
        hero: ['#0A0F1A', '#111827'],
        active: [GOLD, GOLD_DEEP],
        emerald: [SUCCESS, SUCCESS_DEEP],
        mesh: [GOLD, GOLD_DEEP, '#0A0F1A'],
    },
};

export function getTheme(mode: 'light' | 'dark'): ThemePalette {
    return mode === 'dark' ? darkPalette : lightPalette;
}

/** Default export for backward compatibility — resolves to light. Use useTheme() for adaptive theme. */
export const theme = lightPalette;

/**
 * Shape expected by the `useThemeColor` hook from the Expo starter template.
 * Derived from the palettes above so it cannot describe a different app.
 */
export const Colors = {
    light: {
        text: lightPalette.colors.text,
        background: lightPalette.colors.background,
        tint: lightPalette.colors.active,
        icon: lightPalette.colors.textMuted,
        tabIconDefault: lightPalette.colors.textMuted,
        tabIconSelected: lightPalette.colors.active,
    },
    dark: {
        text: darkPalette.colors.text,
        background: darkPalette.colors.background,
        tint: darkPalette.colors.active,
        icon: darkPalette.colors.textMuted,
        tabIconDefault: darkPalette.colors.textMuted,
        tabIconSelected: darkPalette.colors.active,
    },
} as const;
