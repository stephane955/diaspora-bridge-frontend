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

const lightPalette: ThemePalette = {
    colors: {
        primary: '#0F172A',
        primarySoft: '#1E293B',
        active: '#0EA5E9',
        activeSoft: '#38BDF8',
        emerald: '#10B981',
        emeraldSoft: '#34D399',
        background: '#F8FAFC',
        surfaceAlt: '#F1F5F9',
        surface: '#FFFFFF',
        text: '#0F172A',
        textMuted: '#64748B',
        textSubtle: '#94A3B8',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        border: '#E2E8F0',
        glass: 'rgba(255,255,255,0.65)',
        glassBright: 'rgba(255,255,255,0.85)',
        glassDark: 'rgba(15,23,42,0.7)',
    },
    gradient: {
        screen: ['#F8FAFC', '#F1F5F9', '#FFFFFF'],
        hero: ['#0F172A', '#1E293B'],
        active: ['#0EA5E9', '#38BDF8'],
        emerald: ['#10B981', '#34D399'],
        mesh: ['#0EA5E9', '#6366F1', '#8B5CF6'],
    },
    radii: { xs: 8, sm: 12, md: 16, lg: 20, xl: 32, pill: 999 },
    spacing: { xs: 6, sm: 10, md: 16, lg: 20, xl: 28, xxl: 36 },
    shadow: {
        soft: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 5 },
        glow: { shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
        glowEmerald: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
    },
    typography: {
        title: { fontWeight: '800' as const, letterSpacing: -0.5 },
        subtitle: { fontWeight: '500' as const, color: '#64748B' },
        body: { fontWeight: '400' as const },
        label: { fontWeight: '700' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
    },
    font: { display: 'Avenir Next', body: 'Avenir Next' },
};

/** Deep Midnight — dark mode palette */
const darkPalette: ThemePalette = {
    ...lightPalette,
    colors: {
        ...lightPalette.colors,
        primary: '#0B0E14',
        primarySoft: '#161B22',
        background: '#0B0E14',
        surfaceAlt: '#161B22',
        surface: '#161B22',
        text: '#F1F5F9',
        textMuted: '#94A3B8',
        textSubtle: '#64748B',
        border: '#1E293B',
        glass: 'rgba(22,27,34,0.8)',
        glassBright: 'rgba(22,27,34,0.9)',
        glassDark: 'rgba(11,14,20,0.85)',
    },
    gradient: {
        screen: ['#0B0E14', '#161B22', '#0B0E14'],
        hero: ['#0B0E14', '#161B22'],
        active: ['#0EA5E9', '#38BDF8'],
        emerald: ['#10B981', '#34D399'],
        mesh: ['#0EA5E9', '#6366F1', '#8B5CF6'],
    },
};

export function getTheme(mode: 'light' | 'dark'): ThemePalette {
    return mode === 'dark' ? darkPalette : lightPalette;
}

/** Default export for backward compatibility — resolves to light. Use useTheme() for adaptive theme. */
export const theme = lightPalette;
