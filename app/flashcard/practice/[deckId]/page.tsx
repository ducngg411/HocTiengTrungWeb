"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";
import AudioButton from "@/components/AudioButton";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type ApiError = {
    error?: string;
};

type CardStatus = "new" | "learning" | "mastered";

type CardProgress = {
    reviewCount: number;
    lastReviewedAt: string | null;
    status: CardStatus;
    totalStudySeconds: number;
};

type VocabItem = {
    hanzi: string;
    pinyin: string;
    meaning: string;
    example: string;
    examplePinyin: string;
    exampleMeaning: string;
};

type CardPayload = {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    example: string;
    examplePinyin: string;
    exampleMeaning: string;
    progress: CardProgress;
};

type PracticeCard = {
    id: string;
    content: VocabItem;
    progress: CardProgress;
};

type PracticeMode = "writing" | "sentence" | "quiz" | "listening";

export default function PracticeDeckPage() {
    const router = useRouter();
    const params = useParams<{ deckId: string }>();

    const deckId = typeof params.deckId === "string" ? params.deckId : "";

    const [username, setUsername] = useState("");
    const [deckName, setDeckName] = useState("Practice Deck");
    const [cards, setCards] = useState<PracticeCard[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLanguage();
    
    // Practice Mode State
    const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(null);
    const [cardIndex, setCardIndex] = useState(0);
    
    // Writing Mode State
    const [inputValue, setInputValue] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [answerState, setAnswerState] = useState<"idle" | "correct" | "incorrect">("idle");
    const [sessionScore, setSessionScore] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = getStoredUsername();
        if (!saved) {
            router.replace("/login");
            return;
        }
        setUsername(saved);
    }, [router]);

    useEffect(() => {
        const loadData = async () => {
            if (!username || !deckId) return;

            setIsLoading(true);
            setError(null);

            try {
                const [decksResponse, cardsResponse] = await Promise.all([
                    fetch(`/api/decks?username=${encodeURIComponent(username)}`, { cache: "no-store" }),
                    fetch(`/api/decks/${encodeURIComponent(deckId)}/cards?username=${encodeURIComponent(username)}`, {
                        cache: "no-store",
                    }),
                ]);

                const decksPayload = await decksResponse.json();
                if (!decksResponse.ok || !Array.isArray(decksPayload)) throw new Error(t("common.error"));
                
                const selectedDeck = decksPayload.find((deck: any) => deck.id === deckId);
                if (!selectedDeck) throw new Error(t("study.deckNotFound"));

                setDeckName(selectedDeck.name);

                const cardsPayload = await cardsResponse.json();
                if (!cardsResponse.ok || !Array.isArray(cardsPayload)) throw new Error(t("common.error"));

                const mappedCards = cardsPayload.map((item: CardPayload) => ({
                    id: item.id,
                    content: {
                        hanzi: item.word,
                        pinyin: item.pinyin,
                        meaning: item.meaning,
                        example: item.example,
                        examplePinyin: item.examplePinyin,
                        exampleMeaning: item.exampleMeaning,
                    },
                    progress: item.progress,
                })).filter((item) => item.content.hanzi);

                // For practice, let's shuffle them initially so it's fresh
                const shuffled = [...mappedCards].sort(() => Math.random() - 0.5);
                setCards(shuffled);
            } catch (loadError) {
                const message = loadError instanceof Error ? loadError.message : t("common.error");
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };

        void loadData();
    }, [deckId, username]);

    // Handle focus on input when moving to a new card in writing mode
    useEffect(() => {
        if (selectedMode === "writing" && answerState === "idle" && inputRef.current) {
            inputRef.current.focus();
        }
    }, [cardIndex, selectedMode, answerState]);

    const handleLogout = () => {
        clearStoredUsername();
        router.replace("/login");
    };

    const hasCards = cards.length > 0;
    const currentCard = hasCards ? cards[cardIndex % cards.length] : null;

    const startMode = (mode: PracticeMode) => {
        setSelectedMode(mode);
        setCardIndex(0);
        setSessionScore(0);
        resetTurnState();
    };

    const resetTurnState = () => {
        setInputValue("");
        setShowHint(false);
        setAnswerState("idle");
    };

    const handleWritingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCard || answerState !== "idle") return;

        const answer = inputValue.trim();
        if (!answer) return;

        // Compare ignoring case just in case, though Hanzi doesn't have casing.
        if (answer === currentCard.content.hanzi) {
            setAnswerState("correct");
            setSessionScore(prev => prev + 1);
            
            // Auto advance after 1 second
            setTimeout(() => {
                setCardIndex(prev => prev + 1);
                resetTurnState();
            }, 1000);
        } else {
            setAnswerState("incorrect");
            // Highlight error briefly then let them try again
            setTimeout(() => {
                setAnswerState("idle");
                if (inputRef.current) inputRef.current.focus();
            }, 1000);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            <div className="mx-auto w-full max-w-[960px] flex flex-1 flex-col">
                <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md flex flex-none items-center justify-between whitespace-nowrap border-b border-primary/10 px-4 py-4 lg:px-6">
                    <div className="flex items-center gap-4">
                        {selectedMode ? (
                            <button onClick={() => setSelectedMode(null)} className="text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
                                <span className="material-symbols-outlined text-3xl">arrow_back</span>
                            </button>
                        ) : (
                            <Link href="/flashcard" className="text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
                                <span className="material-symbols-outlined text-3xl">arrow_back</span>
                            </Link>
                        )}
                        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight max-w-[200px] truncate sm:max-w-xs">
                            {selectedMode === "writing" ? t("practice.writingModeTitle") : t("practice.practiceDeck", { name: deckName })}
                        </h2>
                    </div>
                    <div className="flex justify-end gap-3 sm:gap-4">
                        <LanguageSwitcher />
                        <button onClick={handleLogout} className="aspect-square rounded-full size-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold transition-opacity hover:opacity-80">
                            {username ? username.charAt(0).toUpperCase() : "U"}
                        </button>
                    </div>
                </header>

                {isLoading && (
                    <div className="m-4 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                        {t("practice.loading")}
                    </div>
                )}

                {!isLoading && error && (
                    <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                        {error}
                    </div>
                )}

                {!isLoading && !error && !selectedMode && (
                    <main className="flex flex-col flex-1 px-4 py-8 max-w-3xl mx-auto w-full items-center justify-start gap-8">
                        <div className="text-center">
                            <h1 className="text-3xl font-extrabold text-indigo-950 dark:text-indigo-100 mb-2 mt-4">{t("practice.title")}</h1>
                            <p className="text-indigo-700/70 dark:text-indigo-300/70 font-medium">{t("practice.subtitle")}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            {/* Available Mode */}
                            <button 
                                onClick={() => startMode("writing")}
                                className="group flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500/20 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all text-left relative overflow-hidden"
                            >
                                <div className="absolute -right-6 -top-6 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors pointer-events-none">
                                    <span className="material-symbols-outlined text-[120px]">edit_square</span>
                                </div>
                                <div className="size-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl">edit_square</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("practice.modes.writing.title")}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("practice.modes.writing.desc")}</p>
                            </button>

                            {/* Coming Soon Modes */}
                            <div className="flex flex-col p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent opacity-60 relative overflow-hidden">
                                <span className="absolute top-4 right-4 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold uppercase px-2 py-1 rounded-full">{t("practice.comingSoon")}</span>
                                <div className="size-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl">view_timeline</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">{t("practice.modes.sentence.title")}</h3>
                                <p className="text-slate-400 text-sm font-medium">{t("practice.modes.sentence.desc")}</p>
                            </div>

                            <div className="flex flex-col p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent opacity-60 relative overflow-hidden">
                                <span className="absolute top-4 right-4 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold uppercase px-2 py-1 rounded-full">{t("practice.comingSoon")}</span>
                                <div className="size-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl">quiz</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">{t("practice.modes.quiz.title")}</h3>
                                <p className="text-slate-400 text-sm font-medium">{t("practice.modes.quiz.desc")}</p>
                            </div>

                            <div className="flex flex-col p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent opacity-60 relative overflow-hidden">
                                <span className="absolute top-4 right-4 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold uppercase px-2 py-1 rounded-full">{t("practice.comingSoon")}</span>
                                <div className="size-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl">headphones</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">{t("practice.modes.listening.title")}</h3>
                                <p className="text-slate-400 text-sm font-medium">{t("practice.modes.listening.desc")}</p>
                            </div>
                        </div>
                    </main>
                )}

                {!isLoading && !error && selectedMode === "writing" && currentCard && (
                    <main className="flex-1 flex flex-col px-4 py-8 lg:px-8 max-w-2xl mx-auto w-full">
                        {/* Progress Bar Top */}
                        <div className="w-full flex items-center gap-4 mb-10 mt-2">
                            <div className="text-indigo-400 dark:text-indigo-500 font-bold text-sm w-12 text-right">
                                {cardIndex + 1}/{cards.length}
                            </div>
                            <div className="flex-1 h-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${Math.min(100, Math.max(0, (cardIndex / cards.length) * 100))}%` }}
                                ></div>
                            </div>
                            <div className="w-12 text-center text-xs font-bold text-slate-400">
                                🎯 {sessionScore}
                            </div>
                        </div>

                        {/* Writing Container */}
                        <div className="flex flex-col items-center justify-center flex-1 w-full gap-8">
                            
                            <div className="text-center max-w-lg mb-4 flex flex-col items-center gap-3">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t("practice.writing.prompt")}</p>
                                <h3 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight">
                                    {currentCard.content.meaning}
                                </h3>
                                
                                <div className="flex items-center gap-4 mt-2">
                                    <AudioButton text={currentCard.content.hanzi} minimal={false} />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowHint(true)}
                                        className="text-sm font-bold text-amber-500 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-2 transition-colors flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">lightbulb</span> {t("practice.writing.hint")}
                                    </button>
                                </div>
                                
                                {showHint && (
                                    <div className="mt-4 px-6 py-3 bg-white/50 border border-slate-200 rounded-xl text-center shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">{t("practice.writing.pinyin")}</p>
                                        <p className="text-2xl font-bold text-primary">{currentCard.content.pinyin}</p>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleWritingSubmit} className="w-full relative max-w-sm">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={t("practice.writing.inputPlaceholder")}
                                    className={`w-full text-center text-3xl py-6 px-4 rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-sm transition-all focus:outline-none placeholder:text-slate-300 ${
                                        answerState === 'idle' ? 'border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800 dark:text-slate-100' :
                                        answerState === 'correct' ? 'border-green-500 bg-green-50 text-green-700 scale-105' :
                                        'border-red-500 bg-red-50 text-red-700 animate-[shake_0.4s_ease-in-out]'
                                    }`}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    disabled={answerState === "correct"}
                                />
                                
                                {/* Feedback Icons overlay */}
                                {answerState === "correct" && (
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-3xl">check_circle</span>
                                )}
                                {answerState === "incorrect" && (
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-3xl">cancel</span>
                                )}
                            </form>
                            
                            {/* Skip / Next action manually (fallback if auto doesn't suit them or they want to skip) */}
                            {answerState === "idle" && (
                                <button type="button" onClick={() => {
                                    setCardIndex(prev => prev + 1);
                                    resetTurnState();
                                }} className="text-slate-400 font-bold hover:text-slate-600 transition-colors mt-8">
                                    {t("practice.writing.skipCard")}
                                </button>
                            )}

                        </div>
                    </main>
                )}
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    50% { transform: translateX(8px); }
                    75% { transform: translateX(-8px); }
                }
            `}} />
        </div>
    );
}
