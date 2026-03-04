import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, type ThemeMode, type ThemePalette } from '@/constants/theme';

const STORAGE_KEY = 'diaspora_theme_mode';

type ThemeContextType = {
    theme: ThemePalette;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
            if (stored === 'light' || stored === 'dark' || stored === 'system') {
                setThemeModeState(stored);
            }
        });
    }, []);

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await AsyncStorage.setItem(STORAGE_KEY, mode);
    };

    const resolved: 'light' | 'dark' =
        themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;

    const theme = useMemo(() => getTheme(resolved), [resolved]);
    const isDark = resolved === 'dark';

    const value = useMemo(
        () => ({ theme, themeMode, setThemeMode, isDark }),
        [theme, themeMode, isDark],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
