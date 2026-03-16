"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Language, translations, getTranslation } from "./translations";

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "flashcard_app_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("vi");
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load preference securely on client side
        const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
        if (savedLang && ["vi", "en", "zh"].includes(savedLang)) {
            setLanguageState(savedLang);
        } else {
            // Default to 'vi' or check browser lang if preferred
            setLanguageState("vi");
        }
        setIsLoaded(true);
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    };

    const t = (key: string, params?: Record<string, string | number>): string => {
        const dict = translations[language];
        let text = getTranslation(dict, key);

        // Simple interpolation: repace {count} with params.count
        if (params && text !== key) {
            Object.keys(params).forEach(pKey => {
                const regex = new RegExp(`{${pKey}}`, 'g');
                text = text.replace(regex, String(params[pKey]));
            });
        }
        return text;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {/* Prevent flash of unstyled translation or default language */}
            <div style={{ visibility: isLoaded ? "visible" : "hidden", display: "contents" }}>
                {children}
            </div>
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
