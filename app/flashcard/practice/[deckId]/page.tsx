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

type PracticeMode = "writing" | "quiz" | "listening";
type WritingSubMode = "typing-recall" | "sentence-ai";
type SentenceExerciseMode = "specific" | "random" | "translation";

type SentenceExercise = {
    exerciseId: string;
    cardId: string;
    mode: SentenceExerciseMode;
    instruction: string;
    sourceText: string;
    expectedText: string;
    word: string;
    meaning: string;
    pinyin: string;
};

type SentenceSubmitResult = {
    score: number;
    usageScore: number;
    grammarScore: number;
    naturalnessScore: number;
    correctUsage: boolean;
    feedback: string;
    improvedSentence: string;
    improvedPinyin: string;
    improvedMeaning: string;
};

type GeminiKeyInfo = {
    keySuffix: string;
    usageToday: number;
    limit: number;
    exhausted: boolean;
};

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
    const [selectedWritingMode, setSelectedWritingMode] = useState<WritingSubMode>("typing-recall");
    const [cardIndex, setCardIndex] = useState(0);

    // Writing Mode State
    const [inputValue, setInputValue] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [answerState, setAnswerState] = useState<"idle" | "correct" | "incorrect">("idle");
    const [sessionScore, setSessionScore] = useState(0);

    // Sentence AI Mode State
    const [sentenceExerciseMode, setSentenceExerciseMode] = useState<SentenceExerciseMode>("random");
    const [specificCardId, setSpecificCardId] = useState("");
    const [sentenceExercise, setSentenceExercise] = useState<SentenceExercise | null>(null);
    const [sentenceAnswer, setSentenceAnswer] = useState("");
    const [sentenceResult, setSentenceResult] = useState<SentenceSubmitResult | null>(null);
    const [sentenceStartedAt, setSentenceStartedAt] = useState<number>(Date.now());
    const [isSentenceLoading, setIsSentenceLoading] = useState(false);
    const [isSentenceSubmitting, setIsSentenceSubmitting] = useState(false);

    // Gemini Key Status
    const [geminiKeys, setGeminiKeys] = useState<GeminiKeyInfo[]>([]);
    const [isSkippingKey, setIsSkippingKey] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const logApiResult = (api: string, status: number, payload: unknown) => {
        console.log(`[Practice API] ${api}`, {
            status,
            payload,
            at: new Date().toISOString(),
        });
    };

    const fetchGeminiKeyStatus = async () => {
        try {
            const res = await fetch("/api/gemini/keys");
            if (res.ok) {
                const data = (await res.json()) as { keys: GeminiKeyInfo[] };
                setGeminiKeys(data.keys);
            }
        } catch {
            // không cần xử lý lỗi UI cho phần này
        }
    };

    const skipGeminiKey = async () => {
        setIsSkippingKey(true);
        try {
            const res = await fetch("/api/gemini/keys", { method: "POST" });
            if (res.ok) {
                const data = (await res.json()) as { skipped: string | null; keys: GeminiKeyInfo[] };
                setGeminiKeys(data.keys);
                if (data.skipped) {
                    console.log(`[Gemini] Manually skipped key ${data.skipped}`);
                }
            }
        } finally {
            setIsSkippingKey(false);
        }
    };

    useEffect(() => {
        const saved = getStoredUsername();
        if (!saved) {
            router.replace("/login");
            return;
        }
        setUsername(saved);
        void fetchGeminiKeyStatus();

        // Auto-refresh key status every 10s so the counter stays in sync
        const interval = setInterval(() => void fetchGeminiKeyStatus(), 10_000);
        return () => clearInterval(interval);
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

    useEffect(() => {
        if (!specificCardId && cards.length > 0) {
            setSpecificCardId(cards[0].id);
        }
    }, [cards, specificCardId]);

    const handleLogout = () => {
        clearStoredUsername();
        router.replace("/login");
    };

    const hasCards = cards.length > 0;
    const currentCard = hasCards ? cards[cardIndex % cards.length] : null;

    const startMode = (mode: PracticeMode) => {
        setSelectedMode(mode);
        setSelectedWritingMode("typing-recall");
        setCardIndex(0);
        setSessionScore(0);
        setSentenceExercise(null);
        setSentenceAnswer("");
        setSentenceResult(null);
        setSentenceStartedAt(Date.now());
        resetTurnState();
    };

    const generateSentenceExercise = async (mode: SentenceExerciseMode, cardId?: string) => {
        if (!username || !deckId) return;

        setIsSentenceLoading(true);
        setSentenceResult(null);

        try {
            const response = await fetch("/api/practice/sentence/exercise", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    deckId,
                    mode,
                    cardId: mode === "specific" ? cardId : undefined,
                }),
            });

            const payload = (await response.json()) as SentenceExercise | ApiError;
            logApiResult("POST /api/practice/sentence/exercise", response.status, payload);
            if (!response.ok || !("exerciseId" in payload)) {
                throw new Error((payload as ApiError).error || t("common.error"));
            }

            setSentenceExercise(payload as SentenceExercise);
            setSentenceAnswer("");
            setSentenceStartedAt(Date.now());
        } catch (exerciseError) {
            const message = exerciseError instanceof Error ? exerciseError.message : t("common.error");
            setError(message);
        } finally {
            setIsSentenceLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMode !== "writing" || selectedWritingMode !== "sentence-ai" || !username || !deckId) return;

        if (sentenceExerciseMode === "specific") {
            if (!specificCardId) return;
            void generateSentenceExercise("specific", specificCardId);
            return;
        }

        void generateSentenceExercise(sentenceExerciseMode);
    }, [selectedMode, selectedWritingMode, sentenceExerciseMode, specificCardId, username, deckId]);

    const submitSentenceAnswer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !sentenceExercise || !sentenceAnswer.trim()) return;

        setIsSentenceSubmitting(true);

        try {
            const studySeconds = Math.max(1, Math.round((Date.now() - sentenceStartedAt) / 1000));

            const response = await fetch("/api/practice/sentence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    exerciseId: sentenceExercise.exerciseId,
                    answer: sentenceAnswer,
                    studySeconds,
                }),
            });

            const payload = (await response.json()) as SentenceSubmitResult | ApiError;
            logApiResult("POST /api/practice/sentence", response.status, payload);
            if (!response.ok || !("score" in payload)) {
                throw new Error((payload as ApiError).error || t("common.error"));
            }

            setSentenceResult(payload as SentenceSubmitResult);
            void fetchGeminiKeyStatus();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : t("common.error");
            setError(message);
        } finally {
            setIsSentenceSubmitting(false);
        }
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
                        <div className="mb-6 inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-1 self-start">
                            <button
                                type="button"
                                onClick={() => setSelectedWritingMode("typing-recall")}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedWritingMode === "typing-recall"
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                {t("practice.writing.subModes.typing")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedWritingMode("sentence-ai")}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedWritingMode === "sentence-ai"
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                {t("practice.writing.subModes.sentence")}
                            </button>
                        </div>

                        {selectedWritingMode === "typing-recall" && (
                            <>
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
                                            className={`w-full text-center text-3xl py-6 px-4 rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-sm transition-all focus:outline-none placeholder:text-slate-300 ${answerState === 'idle' ? 'border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800 dark:text-slate-100' :
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
                            </>
                        )}

                        {selectedWritingMode === "sentence-ai" && (
                            <div className="flex flex-col gap-5">
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                                        {t("practice.sentence.modeLabel")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSentenceExerciseMode("specific")}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold ${sentenceExerciseMode === "specific" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                }`}
                                        >
                                            {t("practice.sentence.modes.specific")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSentenceExerciseMode("random")}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold ${sentenceExerciseMode === "random" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                }`}
                                        >
                                            {t("practice.sentence.modes.random")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSentenceExerciseMode("translation")}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold ${sentenceExerciseMode === "translation" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                }`}
                                        >
                                            {t("practice.sentence.modes.translation")}
                                        </button>
                                    </div>

                                    {sentenceExerciseMode === "specific" && (
                                        <div className="mt-4">
                                            <label className="text-xs font-medium text-slate-500 block mb-2">{t("practice.sentence.chooseWord")}</label>
                                            <select
                                                value={specificCardId}
                                                onChange={(e) => setSpecificCardId(e.target.value)}
                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                                            >
                                                {cards.map((card) => (
                                                    <option key={card.id} value={card.id}>
                                                        {card.content.hanzi} - {card.content.meaning}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {isSentenceLoading && (
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-slate-500">
                                        {t("practice.sentence.loadingExercise")}
                                    </div>
                                )}

                                {!isSentenceLoading && sentenceExercise && (
                                    <div className="rounded-2xl border border-primary/20 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">{t("practice.sentence.instructionLabel")}</p>
                                        <p className="text-slate-800 dark:text-slate-100 font-medium">
                                            {sentenceExercise.mode === "translation" 
                                                ? t("practice.sentence.instructionTranslation", { text: sentenceExercise.sourceText })
                                                : t("practice.sentence.instructionNormal", { word: sentenceExercise.word, meaning: sentenceExercise.meaning || t("common.noMeaning") })
                                            }
                                        </p>

                                        {sentenceExercise.sourceText && (
                                            <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                                                <p className="text-xs text-slate-500 mb-1">{t("practice.sentence.sourceText")}</p>
                                                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{sentenceExercise.sourceText}</p>
                                            </div>
                                        )}

                                        <form onSubmit={submitSentenceAnswer} className="mt-4 relative">
                                            <textarea
                                                value={sentenceAnswer}
                                                onChange={(e) => setSentenceAnswer(e.target.value)}
                                                rows={4}
                                                disabled={isSentenceSubmitting}
                                                placeholder={t("practice.sentence.inputPlaceholder")}
                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800/50"
                                            />
                                            {isSentenceSubmitting && (
                                                <div className="absolute left-0 right-0 -bottom-2 h-1 overflow-hidden bg-primary/10 rounded-full mt-2">
                                                    <div className="h-full bg-primary/80 animate-[indeterminate_1.5s_infinite_ease-in-out]"></div>
                                                </div>
                                            )}
                                            
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={isSentenceSubmitting || !sentenceAnswer.trim()}
                                                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-50 transition-colors hover:bg-primary/90"
                                                >
                                                    {isSentenceSubmitting ? (
                                                        <>
                                                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                                            {t("practice.sentence.submitting")}
                                                        </>
                                                    ) : (
                                                        t("practice.sentence.submit")
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSentenceSubmitting}
                                                    onClick={() => {
                                                        if (sentenceExerciseMode === "specific") {
                                                            void generateSentenceExercise("specific", specificCardId);
                                                        } else {
                                                            void generateSentenceExercise(sentenceExerciseMode);
                                                        }
                                                    }}
                                                    className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                                >
                                                    {t("practice.sentence.nextExercise")}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* Gemini Key Status Widget (Redesigned) */}
                                {geminiKeys.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-3 text-xs w-full">
                                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                                            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                                            {t("practice.sentence.apiKeysLabel")}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-[120px]">
                                            {(() => {
                                                const activeIdx = geminiKeys.findIndex((k) => !k.exhausted);
                                                return geminiKeys.map((k, i) => (
                                                    <span
                                                        key={i}
                                                        title={`${k.keySuffix} — ${k.usageToday}/${k.limit} ${t("practice.sentence.requests")}${i === activeIdx ? t("practice.sentence.activeKey") : ""}`}
                                                        className={`rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-inset ${
                                                            k.exhausted
                                                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-slate-700 line-through opacity-70"
                                                                : i === activeIdx
                                                                ? "bg-primary text-slate-900 ring-primary/50 font-bold shadow-sm"
                                                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700"
                                                        }`}
                                                    >
                                                        K{i + 1} <span className="opacity-75 font-normal ml-0.5">{k.usageToday}/{k.limit}</span>
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                        
                                        <button
                                            type="button"
                                            onClick={() => void skipGeminiKey()}
                                            disabled={isSkippingKey || geminiKeys.every((k) => k.exhausted)}
                                            title={t("practice.sentence.skipKeyTooltip")}
                                            className="ml-auto flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors shadow-sm"
                                        >
                                            {isSkippingKey ? (
                                                <>
                                                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                                    {t("practice.sentence.switchingKey")}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                                    {t("practice.sentence.switchKey").replace("⇄ ", "")}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {sentenceResult && (
                                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 p-5">
                                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{t("practice.sentence.score")}: {sentenceResult.score}/10</p>
                                        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                            <p>✔ {t("practice.sentence.usage")}: {sentenceResult.usageScore}/10</p>
                                            <p>⚠ {t("practice.sentence.grammar")}: {sentenceResult.grammarScore}/10</p>
                                            <p>💡 {t("practice.sentence.naturalness")}: {sentenceResult.naturalnessScore}/10</p>
                                        </div>
                                        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                                            <span className="font-semibold">{t("practice.sentence.feedback")}:</span> {sentenceResult.feedback || t("practice.sentence.noFeedback")}
                                        </p>
                                        {sentenceResult.improvedSentence && (
                                            <div className="mt-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-emerald-200 dark:border-emerald-700 p-3">
                                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">{t("practice.sentence.suggestion")}</p>
                                                <p className="text-base font-bold text-slate-800 dark:text-slate-100">{sentenceResult.improvedSentence}</p>
                                                {sentenceResult.improvedPinyin && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic mt-0.5">{sentenceResult.improvedPinyin}</p>
                                                )}
                                                {sentenceResult.improvedMeaning && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{sentenceResult.improvedMeaning}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    50% { transform: translateX(8px); }
                    75% { transform: translateX(-8px); }
                }
                @keyframes indeterminate {
                    0% { transform: translateX(-100%) scaleX(0.2); }
                    20% { transform: translateX(-50%) scaleX(0.5); }
                    100% { transform: translateX(100%) scaleX(0.2); }
                }
            `}} />
        </div>
    );
}
