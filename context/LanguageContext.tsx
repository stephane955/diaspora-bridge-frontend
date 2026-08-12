import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/translations';

type Language = 'en' | 'fr' | 'es' | 'de' | 'it';
type TranslationKey = keyof typeof translations.en;

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    /** Lookup translation; never returns raw missing keys when EN exists. */
    t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
    getFlag: () => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const VALID: Language[] = ['en', 'fr', 'es', 'de', 'it'];

function interpolate(template: string, vars?: Record<string, string | number>) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : `{${name}}`,
    );
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [language, setLanguageState] = useState<Language>('en');

    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem('userLanguage');
                if (saved && VALID.includes(saved as Language)) {
                    setLanguageState(saved as Language);
                } else {
                    setLanguageState('en');
                }
            } catch {
                setLanguageState('en');
            }
        })();
    }, []);

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        await AsyncStorage.setItem('userLanguage', lang);
    };

    const t = useCallback(
        (key: TranslationKey | string, vars?: Record<string, string | number>) => {
            const pack = translations[language] as Record<string, string>;
            const enPack = translations.en as Record<string, string>;
            const value = pack[key] ?? enPack[key];
            // If still missing, surface a readable fallback instead of camelCase keys
            if (!value) {
                const human = key
                    .replace(/^clientDashboard\./, '')
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/[._]/g, ' ')
                    .trim();
                return interpolate(human.charAt(0).toUpperCase() + human.slice(1), vars);
            }
            return interpolate(value, vars);
        },
        [language],
    );

    const getFlag = () => translations[language].flag || '🇺🇸';

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, getFlag }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
