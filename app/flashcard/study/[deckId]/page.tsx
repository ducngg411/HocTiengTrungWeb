"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Flashcard, { VocabItem } from "@/components/Flashcard";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";
import AudioButton from "@/components/AudioButton";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type ApiError = {
    error?: string;
};

type DeckSummary = {
    id: string;
    name: string;
    description: string;
    sheetName: string;
    cardCount: number;
    createdAt: string;
};

type CardStatus = "new" | "learning" | "mastered";
type ReviewAction = "hard" | "easy";
type StudyMode = "learn" | "review-today" | "review-yesterday" | "review-last" | "review-all" | "hard" | "random";

type CardProgress = {
    reviewCount: number;
    lastReviewedAt: string | null;
    status: CardStatus;
    totalStudySeconds: number;
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

type DeckProgressResponse = {
    deckId: string;
    deckName: string;
    totalCards: number;
    reviewedCards: number;
    learningCards: number;
    masteredCards: number;
    unseenCards: number;
    remainingCards: number;
    todayStudied: number;
    progressPercent: number;
    masteredProgressPercent: number;
};

type StudyCard = {
    id: string;
    content: VocabItem;
    progress: CardProgress;
};

type StudyModeOption = {
    key: StudyMode;
    icon: string;
};

type ReviewOptionData = {
    count: number;
    cardIds: string[];
    startedAt?: string | null;
};

type ReviewOptionsResponse = {
    today: ReviewOptionData;
    yesterday: ReviewOptionData;
    lastSession: ReviewOptionData;
    allLearned: ReviewOptionData;
};

// Non-review modes shown in the main grid
const MODE_OPTIONS: StudyModeOption[] = [
    { key: "learn", icon: "style" },
    { key: "hard", icon: "psychology" },
    { key: "random", icon: "shuffle" },
];

const REVIEW_SUB_MODE_ICONS: Record<string, string> = {
    "review-today": "today",
    "review-yesterday": "history",
    "review-last": "replay",
    "review-all": "library_books",
};

function isReviewSubMode(mode: StudyMode): boolean {
    return mode.startsWith("review-");
}

function mapCard(item: CardPayload): StudyCard {
    return {
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
    };
}

function formatDate(dateValue: string | null): string {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatStatusLabel(status: CardStatus, t: (key: string) => string): { label: string; className: string } {
    if (status === "new") return { label: t("study.status.new"), className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    if (status === "learning") return { label: t("study.status.learning"), className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    return { label: t("study.status.mastered"), className: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
}

function formatMinutes(totalStudySeconds: number): string {
    return `${Math.max(1, Math.round(totalStudySeconds / 60))} phút`;
}

function getEmptyModeMessage(mode: StudyMode, t: (key: string) => string): string {
    if (isReviewSubMode(mode)) return "Không có thẻ nào để ôn trong phiên này.";
    return t("study.emptyModes." + mode);
}

function createSeededRandom(seed: number): () => number {
    let value = seed;
    return () => {
        value += 0x6D2B79F5;
        let next = value;
        next = Math.imul(next ^ (next >>> 15), next | 1);
        next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
        return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleCards(cards: StudyCard[], seed: number): StudyCard[] {
    const random = createSeededRandom(seed);
    const copy = [...cards];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

function getActiveCardsForMode(
    cards: StudyCard[],
    mode: StudyMode,
    seed: number,
    reviewOptions: ReviewOptionsResponse | null = null
): StudyCard[] {
    if (mode === "learn") return cards.filter((c) => c.progress.status === "new");
    if (mode === "hard") return cards.filter((c) => c.progress.status === "learning");
    if (mode === "random") return shuffleCards(cards, seed);

    if (reviewOptions) {
        const optionMap: Record<string, ReviewOptionData | undefined> = {
            "review-today": reviewOptions.today,
            "review-yesterday": reviewOptions.yesterday,
            "review-last": reviewOptions.lastSession,
            "review-all": reviewOptions.allLearned,
        };
        const option = optionMap[mode];
        if (option) {
            const ids = new Set(option.cardIds);
            return cards.filter((c) => ids.has(c.id));
        }
    }

    return cards;
}

export default function StudyDeckPage() {
    const router = useRouter();
    const params = useParams<{ deckId: string }>();
    const deckId = typeof params.deckId === "string" ? params.deckId : "";

    const { t } = useLanguage();

    const [username, setUsername] = useState("");
    const [deckName, setDeckName] = useState("Deck");
    const [cards, setCards] = useState<StudyCard[]>([]);
    const [deckProgress, setDeckProgress] = useState<DeckProgressResponse | null>(null);
    const [selectedMode, setSelectedMode] = useState<StudyMode>("learn");
    const [randomSeed, setRandomSeed] = useState(() => Date.now());
    const [index, setIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [studyActive, setStudyActive] = useState(false);
    const [isViewingAll, setIsViewingAll] = useState(false);

    // Navigation history — like browser Back/Forward
    const [navHistory, setNavHistory] = useState<string[]>([]); // reviewed card IDs in order
    const [historyPos, setHistoryPos] = useState<number>(-1);   // -1 = present, >=0 = viewing a past card
    const [historyReturnIndex, setHistoryReturnIndex] = useState<number>(0);

    // Review sub-mode state
    const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
    const [reviewOptions, setReviewOptions] = useState<ReviewOptionsResponse | null>(null);
    const [isLoadingReviewOptions, setIsLoadingReviewOptions] = useState(false);

    // Session tracking
    const [sessionId, setSessionId] = useState<string | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const usernameRef = useRef<string>("");

    // Progress tracking for non-learn modes
    const [sessionTotalCards, setSessionTotalCards] = useState(0);
    const [sessionReviewedCards, setSessionReviewedCards] = useState(0);

    const currentCardStartedAtRef = useRef<number>(Date.now());

    const getModeLabel = (modeKey: StudyMode): string => {
        if (modeKey === "review-today") return t("study.modes.reviewToday");
        if (modeKey === "review-yesterday") return t("study.modes.reviewYesterday");
        if (modeKey === "review-last") return t("study.modes.reviewLast");
        if (modeKey === "review-all") return t("study.modes.reviewAll");
        if (modeKey === "learn" && deckProgress?.reviewedCards === 0) return t("study.startLearning");
        return t("study.modes." + modeKey);
    };

    // Keep refs in sync for cleanup callbacks
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { usernameRef.current = username; }, [username]);

    // End session via API (fire-and-forget safe for cleanup)
    const endCurrentSession = useCallback((sid: string | null, user: string) => {
        if (!sid || !user) return;
        void fetch(`/api/sessions/${sid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user }),
            keepalive: true,
        });
    }, []);

    // Cleanup session on unmount
    useEffect(() => {
        return () => {
            endCurrentSession(sessionIdRef.current, usernameRef.current);
        };
    }, [endCurrentSession]);

    useEffect(() => {
        const saved = getStoredUsername();
        if (!saved) { router.replace("/login"); return; }
        setUsername(saved);
    }, [router]);

    const loadProgressData = useCallback(async (activeUsername: string, activeDeckId: string) => {
        const response = await fetch(
            `/api/progress/deck?username=${encodeURIComponent(activeUsername)}&deckId=${encodeURIComponent(activeDeckId)}`,
            { cache: "no-store" }
        );
        const payload = (await response.json()) as DeckProgressResponse | ApiError;
        if (!response.ok || !("deckId" in payload)) throw new Error((payload as ApiError).error || t("common.error"));
        setDeckProgress(payload as DeckProgressResponse);
    }, [t]);

    const loadReviewOptions = useCallback(async (activeUsername: string, activeDeckId: string) => {
        if (!activeUsername || !activeDeckId) return;
        setIsLoadingReviewOptions(true);
        try {
            // Pass timezone offset so server can compute correct day boundaries for the user's locale
            const tz = new Date().getTimezoneOffset();
            const res = await fetch(
                `/api/sessions/review-options?username=${encodeURIComponent(activeUsername)}&deckId=${encodeURIComponent(activeDeckId)}&tz=${tz}`,
                { cache: "no-store" }
            );
            const data = (await res.json()) as ReviewOptionsResponse | ApiError;
            if (res.ok && "today" in data) setReviewOptions(data as ReviewOptionsResponse);
        } catch {
            // non-blocking, silently ignore
        } finally {
            setIsLoadingReviewOptions(false);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!username || !deckId) return;
            setIsLoading(true);
            setError(null);
            try {
                const [decksResponse, cardsResponse] = await Promise.all([
                    fetch(`/api/decks?username=${encodeURIComponent(username)}`, { cache: "no-store" }),
                    fetch(`/api/decks/${encodeURIComponent(deckId)}/cards?username=${encodeURIComponent(username)}`, { cache: "no-store" }),
                ]);

                const decksPayload = (await decksResponse.json()) as DeckSummary[] | ApiError;
                if (!decksResponse.ok || !Array.isArray(decksPayload)) {
                    throw new Error(!Array.isArray(decksPayload) ? decksPayload.error : t("common.error"));
                }

                const selectedDeck = decksPayload.find((deck) => deck.id === deckId);
                if (!selectedDeck) throw new Error(t("study.deckNotFound"));
                setDeckName(selectedDeck.name);

                const cardsPayload = (await cardsResponse.json()) as CardPayload[] | ApiError;
                if (!cardsResponse.ok || !Array.isArray(cardsPayload)) {
                    throw new Error(!Array.isArray(cardsPayload) ? cardsPayload.error : t("common.error"));
                }

                setCards(cardsPayload.map(mapCard).filter((item) => item.content.hanzi));
                setIndex(0);
                setRandomSeed(Date.now());
                currentCardStartedAtRef.current = Date.now();

                await Promise.all([
                    loadProgressData(username, deckId),
                    loadReviewOptions(username, deckId),
                ]);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : t("common.error"));
            } finally {
                setIsLoading(false);
            }
        };
        void loadData();
    }, [deckId, username, loadProgressData, loadReviewOptions, t]);

    const modeCounts = useMemo(() => ({
        learn: cards.filter((c) => c.progress.status === "new").length,
        hard: cards.filter((c) => c.progress.status === "learning").length,
        random: cards.length,
    }), [cards]);

    const activeCards = useMemo(
        () => getActiveCardsForMode(cards, selectedMode, randomSeed, reviewOptions),
        [cards, randomSeed, selectedMode, reviewOptions]
    );

    const hasCards = activeCards.length > 0;
    const safeIndex = useMemo(() => (hasCards ? index % activeCards.length : 0), [activeCards.length, hasCards, index]);
    const currentCard = hasCards ? activeCards[safeIndex] : null;

    // The card actually shown — may be a history card when navigating back
    const historyViewCard = historyPos >= 0 ? (cards.find((c) => c.id === navHistory[historyPos]) ?? null) : null;
    const displayCard = historyViewCard ?? currentCard;

    const canGoBack = historyPos === -1 ? navHistory.length > 0 : historyPos > 0;
    const canGoForward = historyPos !== -1;

    useEffect(() => {
        currentCardStartedAtRef.current = Date.now();
    }, [safeIndex, selectedMode, historyPos]);

    const nextCard = () => { if (hasCards) setIndex((prev) => prev + 1); };
    const previousCard = () => { if (hasCards) setIndex((prev) => (prev - 1 + activeCards.length) % activeCards.length); };

    const goBack = useCallback(() => {
        if (historyPos === -1) {
            if (navHistory.length === 0) return;
            setHistoryReturnIndex(safeIndex);
            setHistoryPos(navHistory.length - 1);
        } else if (historyPos > 0) {
            setHistoryPos((p) => p - 1);
        }
    }, [historyPos, navHistory, safeIndex]);

    const goForward = useCallback(() => {
        if (historyPos === -1) return;
        if (historyPos < navHistory.length - 1) {
            setHistoryPos((p) => p + 1);
        } else {
            setHistoryPos(-1);
        }
    }, [historyPos, navHistory.length]);

    const startSession = useCallback(async (
        mode: StudyMode,
        cardIds: string[],
        currentUsername: string,
        currentDeckId: string
    ): Promise<string | null> => {
        try {
            const scope = mode === "learn" ? "learn"
                : mode === "review-today" ? "today"
                : mode === "review-yesterday" ? "yesterday"
                : mode === "review-last" ? "last-session"
                : mode === "review-all" ? "all-learned"
                : "learn";

            const type = mode === "learn" ? "learn" : "review";

            const res = await fetch("/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: currentUsername, deckId: currentDeckId, type, scope, cardIds }),
            });
            const data = (await res.json()) as { sessionId?: string } | ApiError;
            return res.ok && "sessionId" in data ? (data.sessionId ?? null) : null;
        } catch {
            return null;
        }
    }, []);

    const handleModeChange = useCallback(async (mode: StudyMode) => {
        // End any existing session
        endCurrentSession(sessionIdRef.current, usernameRef.current);
        setSessionId(null);
        sessionIdRef.current = null;

        const seed = mode === "random" ? Date.now() : randomSeed;
        if (mode === "random") setRandomSeed(seed);

        setSelectedMode(mode);
        setIndex(0);
        currentCardStartedAtRef.current = Date.now();
        setStudyActive(true);
        setReviewPanelOpen(false);
        setNavHistory([]);
        setHistoryPos(-1);
        setHistoryReturnIndex(0);

        // Calculate the card IDs going into this session
        const plannedCards = getActiveCardsForMode(cards, mode, seed, reviewOptions);
        const plannedCardIds = plannedCards.map((c) => c.id);

        // Reset session progress counter
        setSessionTotalCards(plannedCardIds.length);
        setSessionReviewedCards(0);

        // Create session record in background (non-blocking for learn mode only when there are cards)
        if (plannedCardIds.length > 0 && (mode === "learn" || isReviewSubMode(mode))) {
            const sid = await startSession(mode, plannedCardIds, usernameRef.current, deckId);
            setSessionId(sid);
            sessionIdRef.current = sid;
        }
    }, [cards, deckId, endCurrentSession, randomSeed, reviewOptions, startSession]);

    const handleBackFromStudy = useCallback(() => {
        endCurrentSession(sessionIdRef.current, usernameRef.current);
        setSessionId(null);
        sessionIdRef.current = null;
        setStudyActive(false);
        setNavHistory([]);
        setHistoryPos(-1);
        setHistoryReturnIndex(0);
    }, [endCurrentSession]);

    const submitReview = async (action: ReviewAction) => {
        const cardToReview = displayCard;
        if (!username || !deckId || !cardToReview) return;

        const isInHistoryMode = historyPos >= 0;

        setIsSubmittingReview(true);
        setError(null);

        try {
            const elapsedSeconds = Math.max(0, Math.round((Date.now() - currentCardStartedAtRef.current) / 1000));

            const response = await fetch("/api/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    deckId,
                    cardId: cardToReview.id,
                    action,
                    studySeconds: elapsedSeconds,
                    sessionId: sessionId ?? undefined,
                }),
            });

            const payload = (await response.json()) as
                | { cardId: string; reviewCount: number; lastReviewedAt: string; status: CardStatus; totalStudySeconds: number }
                | ApiError;

            if (!response.ok || !("cardId" in payload)) {
                throw new Error((payload as ApiError).error || t("common.error"));
            }

            const nextCards = cards.map((item) =>
                item.id === payload.cardId
                    ? { ...item, progress: { reviewCount: payload.reviewCount, lastReviewedAt: payload.lastReviewedAt, status: payload.status, totalStudySeconds: payload.totalStudySeconds } }
                    : item
            );

            setCards(nextCards);
            setSessionReviewedCards((prev) => Math.min(prev + 1, sessionTotalCards));
            await loadProgressData(username, deckId);

            if (isInHistoryMode) {
                // Return to where we were before going back
                setHistoryPos(-1);
                setIndex(historyReturnIndex);
            } else {
                // Normal flow: push card to history, then advance
                setNavHistory((prev) => [...prev, cardToReview.id]);
                const nextActiveCards = getActiveCardsForMode(nextCards, selectedMode, randomSeed, reviewOptions);
                const nextIndex = (() => {
                    if (!nextActiveCards.length) return 0;
                    if (selectedMode === "learn") return Math.min(safeIndex, nextActiveCards.length - 1);
                    if (selectedMode === "hard" && payload.status !== cardToReview.progress.status) return Math.min(safeIndex, nextActiveCards.length - 1);
                    return (safeIndex + 1) % nextActiveCards.length;
                })();
                setIndex(nextIndex);
            }
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : t("common.error"));
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleLogout = () => {
        endCurrentSession(sessionIdRef.current, usernameRef.current);
        clearStoredUsername();
        router.replace("/login");
    };

    const reviewSubModes: { key: StudyMode; label: string; icon: string; data: ReviewOptionData | undefined }[] = [
        { key: "review-today", label: t("study.modes.reviewToday"), icon: "today", data: reviewOptions?.today },
        { key: "review-yesterday", label: t("study.modes.reviewYesterday"), icon: "history", data: reviewOptions?.yesterday },
        { key: "review-last", label: t("study.modes.reviewLast"), icon: "replay", data: reviewOptions?.lastSession },
        { key: "review-all", label: t("study.modes.reviewAll"), icon: "library_books", data: reviewOptions?.allLearned },
    ];

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            <div className="flex h-full grow flex-col">
                <div className="mx-auto w-full max-w-[960px] flex flex-1 flex-col">
                    <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md flex flex-none items-center justify-between whitespace-nowrap border-b border-primary/10 px-4 py-4 lg:px-6">
                        <div className="flex items-center gap-4">
                            {isViewingAll ? (
                                <button onClick={() => setIsViewingAll(false)} className="text-primary hover:opacity-80 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </button>
                            ) : studyActive ? (
                                <button onClick={handleBackFromStudy} className="text-primary hover:opacity-80 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </button>
                            ) : (
                                <Link href="/flashcard" className="text-primary hover:opacity-80 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </Link>
                            )}
                            <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight max-w-[200px] truncate sm:max-w-xs">
                                {isViewingAll ? `${t("study.allCardsTitle")} (${cards.length})` : studyActive ? getModeLabel(selectedMode) : deckName}
                            </h2>
                        </div>
                        <div className="flex justify-end gap-3 sm:gap-4">
                            <LanguageSwitcher />
                            <div className="flex gap-2">
                                <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-primary/10 text-slate-900 dark:text-slate-100 transition-colors hover:bg-primary/20">
                                    <span className="material-symbols-outlined">settings</span>
                                </button>
                            </div>
                            <button onClick={handleLogout} className="aspect-square rounded-full size-10 bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/30 text-primary font-bold transition-opacity hover:opacity-80">
                                {username ? username.charAt(0).toUpperCase() : "U"}
                            </button>
                        </div>
                    </header>

                    {isLoading && (
                        <section className="m-4 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                            {t("study.loadingDeck")}
                        </section>
                    )}

                    {!isLoading && error && (
                        <section className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                            {error}
                        </section>
                    )}

                    {/* Overview / Preview Mode */}
                    {!isLoading && !error && !studyActive && !isViewingAll && (
                        <div className="flex flex-col flex-1 px-4 py-8 lg:px-8 max-w-3xl mx-auto w-full items-center justify-start gap-8">

                            {/* Header info */}
                            <div className="w-full text-center">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{deckName}</h2>
                                <div className="flex items-center justify-center gap-4 text-sm text-slate-500 font-medium mt-3">
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[18px]">style</span>
                                        {cards.length} {t("dashboard.deck.cards")}
                                    </span>
                                    {deckProgress && (
                                        <span className="flex items-center gap-1 text-primary" title={`${deckProgress.progressPercent}% ${t("dashboard.deck.progress")}`}>
                                            <span className="material-symbols-outlined text-[18px]">trending_up</span>
                                            {deckProgress.progressPercent}% {t("dashboard.deck.progress")}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mode grid: 3 standard modes + Học lại toggle */}
                            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                {MODE_OPTIONS.map((mode) => {
                                    const count = modeCounts[mode.key as keyof typeof modeCounts] ?? 0;
                                    return (
                                        <button
                                            key={mode.key}
                                            onClick={() => void handleModeChange(mode.key)}
                                            className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl p-6 border border-primary/10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all gap-4 group"
                                        >
                                            <div className="text-primary group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-[40px] leading-none">{mode.icon}</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-slate-700 dark:text-slate-200">{getModeLabel(mode.key)}</p>
                                                {count > 0 && (
                                                    <p className="text-xs text-slate-400 mt-0.5">{count} {t("dashboard.deck.cards").toLowerCase()}</p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Học lại toggle button */}
                                <button
                                    onClick={() => setReviewPanelOpen((prev) => !prev)}
                                    className={`flex flex-col items-center justify-center rounded-2xl p-6 border shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all gap-4 group ${
                                        reviewPanelOpen
                                            ? "bg-primary/5 border-primary/30"
                                            : "bg-white dark:bg-slate-800 border-primary/10"
                                    }`}
                                >
                                    <div className="text-primary group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-[40px] leading-none">school</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{t("study.modes.review")}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {isLoadingReviewOptions ? "..." : reviewOptions ? `${reviewOptions.allLearned.count} ${t("dashboard.deck.cards").toLowerCase()}` : ""}
                                        </p>
                                    </div>
                                </button>
                            </div>

                            {/* Review sub-mode panel */}
                            {reviewPanelOpen && (
                                <div className="w-full rounded-2xl border border-primary/10 bg-white dark:bg-slate-800 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t("study.reviewScope")}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {reviewSubModes.map((sub) => {
                                            const count = sub.data?.count ?? 0;
                                            const disabled = count === 0;
                                            return (
                                                <button
                                                    key={sub.key}
                                                    disabled={disabled}
                                                    onClick={() => void handleModeChange(sub.key)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                                                        disabled
                                                            ? "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-700/50"
                                                            : "border-primary/10 hover:border-primary/30 hover:bg-primary/5 active:scale-95"
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[22px] text-primary shrink-0">{sub.icon}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{sub.label}</p>
                                                        <p className={`text-xs mt-0.5 font-medium ${disabled ? "text-slate-400" : "text-primary"}`}>
                                                            {isLoadingReviewOptions ? "..." : `${count} ${t("dashboard.deck.cards").toLowerCase()}`}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Preview Flashcards List */}
                            <div className="w-full mt-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{t("study.cardsInDeck")} ({cards.length})</h3>
                                <div className="space-y-3">
                                    {cards.slice(0, 5).map((card) => (
                                        <div key={card.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-primary/5 shadow-sm flex items-center gap-4">
                                            <div className="text-2xl font-bold text-slate-900 dark:text-white w-16 text-center">{card.content.hanzi}</div>
                                            <div className="w-[1px] h-10 bg-slate-100 dark:bg-slate-700"></div>
                                            <div className="flex-1 px-2">
                                                {card.content.pinyin && <p className="text-xs font-semibold text-slate-500 mb-1">{card.content.pinyin}</p>}
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{card.content.meaning}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {cards.length > 5 && (
                                    <button
                                        onClick={() => setIsViewingAll(true)}
                                        className="w-full mt-4 py-4 bg-primary/5 hover:bg-primary/10 text-primary font-bold rounded-2xl transition-colors"
                                    >
                                        {t("study.viewAllCards", { count: cards.length })}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* View All Cards Mode */}
                    {!isLoading && !error && !studyActive && isViewingAll && (
                        <div className="flex flex-col flex-1 px-4 py-6 lg:px-8 max-w-3xl mx-auto w-full items-center justify-start">
                            <div className="w-full space-y-3 pb-8">
                                {cards.map((card) => (
                                    <div key={card.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-primary/5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white w-16 text-center">{card.content.hanzi}</div>
                                        <div className="w-[1px] h-10 bg-slate-100 dark:bg-slate-700"></div>
                                        <div className="flex-1 px-2">
                                            {card.content.pinyin && <p className="text-xs font-semibold text-slate-500 mb-1">{card.content.pinyin}</p>}
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">{card.content.meaning}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <div className="scale-90 opacity-60 hover:opacity-100 transition-opacity flex justify-end w-full cursor-pointer mt-[-4px]">
                                                <AudioButton text={card.content.hanzi} minimal={true} />
                                            </div>
                                            <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${formatStatusLabel(card.progress.status, t).className}`}>
                                                {formatStatusLabel(card.progress.status, t).label}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Study View */}
                    {!isLoading && !error && studyActive && (
                        <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 lg:px-6 relative overflow-y-auto">
                            {displayCard ? (
                                <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md flex flex-col items-center gap-6 py-4">
                                    <Flashcard
                                        key={`${selectedMode}-${displayCard.id}-${historyPos === -1 ? safeIndex : historyPos}`}
                                        item={displayCard.content}
                                        progress={displayCard.progress}
                                        onNext={nextCard}
                                        onSwipeLeft={() => void submitReview("hard")}
                                        onSwipeRight={() => void submitReview("easy")}
                                        isFlippingDisabled={isSubmittingReview}
                                    />

                                    {/* Navigation History Controls */}
                                    <div className="w-full flex items-center justify-center gap-3 -mt-2">
                                        <button
                                            type="button"
                                            onClick={goBack}
                                            disabled={!canGoBack || isSubmittingReview}
                                            title={t("study.btnGoBack")}
                                            className="flex flex-col items-center gap-1 group disabled:opacity-30 transition-opacity"
                                        >
                                            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 group-hover:bg-slate-200 dark:group-hover:bg-slate-600 group-active:scale-90 transition-all shadow-sm">
                                                <span className="material-symbols-outlined text-lg">undo</span>
                                            </div>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("study.btnGoBack")}</span>
                                        </button>

                                        {canGoForward && (
                                            <button
                                                type="button"
                                                onClick={goForward}
                                                disabled={isSubmittingReview}
                                                title={t("study.btnGoForward")}
                                                className="flex flex-col items-center gap-1 group disabled:opacity-30 transition-opacity"
                                            >
                                                <div className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 group-hover:bg-slate-200 dark:group-hover:bg-slate-600 group-active:scale-90 transition-all shadow-sm">
                                                    <span className="material-symbols-outlined text-lg">redo</span>
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("study.btnGoForward")}</span>
                                            </button>
                                        )}

                                        {historyPos >= 0 && (
                                            <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600">
                                                {navHistory.length - historyPos} {t("study.historyStepsBack")}
                                            </span>
                                        )}
                                    </div>

                                    {/* Learning Controls */}
                                    <div className="w-full flex items-center justify-between gap-6 pb-2">
                                        <button
                                            type="button"
                                            onClick={() => void submitReview("hard")}
                                            disabled={isSubmittingReview}
                                            className="flex flex-1 flex-col items-center gap-2 group disabled:opacity-50"
                                        >
                                            <div className="w-full h-14 flex items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-900/30 transition-all group-hover:-translate-x-1 group-active:scale-95 shadow-sm">
                                                <span className="material-symbols-outlined text-3xl">close</span>
                                            </div>
                                            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{t("study.btnHard")}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void submitReview("easy")}
                                            disabled={isSubmittingReview}
                                            className="flex flex-1 flex-col items-center gap-2 group disabled:opacity-50"
                                        >
                                            <div className="w-full h-14 flex items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/20 text-green-500 border border-green-200 dark:border-green-900/30 transition-all group-hover:translate-x-1 group-active:scale-95 shadow-sm">
                                                <span className="material-symbols-outlined text-3xl">check</span>
                                            </div>
                                            <span className="text-xs font-bold text-green-500 uppercase tracking-wider">{t("study.btnEasy")}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : cards.length > 0 ? (
                                <section className="flex-1 flex w-full items-center justify-center p-6 text-center text-slate-500 font-medium">
                                    {getEmptyModeMessage(selectedMode, t)}
                                </section>
                            ) : (
                                <section className="flex-1 flex w-full items-center justify-center p-6 text-center text-slate-500 font-medium">
                                    {t("study.emptyModes.empty")}
                                </section>
                            )}
                        </main>
                    )}

                    {/* Progress Bar Footer */}
                    {studyActive && (
                        <footer className="px-4 py-6 lg:px-6 border-t border-primary/5 mt-auto flex-none">
                            <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
                                <div className="flex justify-between items-center">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("study.progressTitle")} ({getModeLabel(selectedMode)})</p>
                                    {selectedMode === "learn" && deckProgress ? (
                                        <p className="text-primary text-sm font-bold">{deckProgress.reviewedCards}/{deckProgress.totalCards} {t("dashboard.deck.cards")}</p>
                                    ) : (
                                        <p className="text-primary text-sm font-bold">{sessionReviewedCards}/{sessionTotalCards} {t("dashboard.deck.cards")}</p>
                                    )}
                                </div>
                                <div className="relative h-2.5 w-full bg-primary/10 rounded-full overflow-hidden">
                                    {selectedMode === "learn" && deckProgress ? (
                                        <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(19,200,236,0.4)]" style={{ width: `${deckProgress.progressPercent}%` }} />
                                    ) : (
                                        <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(19,200,236,0.4)]" style={{ width: `${sessionTotalCards > 0 ? (sessionReviewedCards / sessionTotalCards) * 100 : 0}%` }} />
                                    )}
                                </div>
                            </div>
                        </footer>
                    )}

                </div>
            </div>
        </div>
    );
}
