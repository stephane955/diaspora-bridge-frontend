import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/translations';

// 1. UPDATE: Add all supported language codes here
type Language = 'en' | 'fr' | 'es' | 'de' | 'it';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: keyof typeof translations.en) => string;
    getFlag: () => string; // <--- NEW: Helper to get the current flag
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [language, setLanguageState] = useState<Language>('en');

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const saved = await AsyncStorage.getItem('userLanguage');

            // 2. UPDATE: Check against all valid languages
            const validLanguages = ['en', 'fr', 'es', 'de', 'it'];

            if (saved && validLanguages.includes(saved)) {
                setLanguageState(saved as Language);
            } else {
                setLanguageState('en');
            }
        } catch (e) {
            setLanguageState('en');
        }
    };

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        await AsyncStorage.setItem('userLanguage', lang);
    };

    // Translation function
    const t = (key: keyof typeof translations.en) => {
        // @ts-ignore: TypeScript might complain if a key is missing in one language, fallback handles it
        return translations[language][key] || translations['en'][key] || key;
    };

    // 3. NEW: Flag Function
    const getFlag = () => {
        // @ts-ignore
        return translations[language].flag || "🇺🇸";
    };

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