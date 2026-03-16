"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Language } from "@/lib/i18n/translations";

const LANGUAGES: { code: Language; label: string; icon: string }[] = [
    { code: "vi", label: "Tiếng Việt", icon: "🇻🇳" },
    { code: "en", label: "English", icon: "🇬🇧" },
    { code: "zh", label: "中文", icon: "🇨🇳" },
];

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center gap-1.5 rounded-xl h-10 px-3 bg-primary/10 text-slate-900 dark:text-slate-100 transition-colors hover:bg-primary/20 font-medium text-sm border border-primary/20"
                title="Change Language"
            >
                <span>{currentLang.icon}</span>
                <span className="hidden sm:inline-block uppercase font-bold text-xs">{currentLang.code}</span>
                <span className="material-symbols-outlined text-[16px] text-primary">translate</span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-primary/10 overflow-hidden z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="flex flex-col">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    setLanguage(lang.code);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors text-left hover:bg-primary/5 ${
                                    language === lang.code 
                                        ? "bg-primary/10 text-primary font-bold" 
                                        : "text-slate-700 dark:text-slate-200"
                                }`}
                            >
                                <span>{lang.icon}</span>
                                <span>{lang.label}</span>
                                {language === lang.code && (
                                    <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
