"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Flashcard, { VocabItem } from "@/components/Flashcard";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";
import AudioButton from "@/components/AudioButton";

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
type StudyMode = "learn" | "review" | "hard" | "random";

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
    label: string;
    description: string;
    icon: string;
};

const MODE_OPTIONS: StudyModeOption[] = [
    {
        key: "learn",
        label: "Học tiếp",
        description: "Học card phân bố theo tiến độ",
        icon: "style"
    },
    {
        key: "review",
        label: "Học lại",
        description: "Ôn lại toàn bộ từ đầu",
        icon: "school"
    },
    {
        key: "hard",
        label: "Thẻ khó",
        description: "Luyện lại các card khó",
        icon: "psychology"
    },
    {
        key: "random",
        label: "Trộn thẻ",
        description: "Học xáo trộn ngẫu nhiên",
        icon: "shuffle"
    },
];

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

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

function formatStatusLabel(status: CardStatus): { label: string; className: string } {
    if (status === "new") return { label: "mới", className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
    if (status === "learning") return { label: "khó", className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
    return { label: "đã nhớ", className: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
}

function formatMinutes(totalStudySeconds: number): string {
    return `${Math.max(1, Math.round(totalStudySeconds / 60))} phút`;
}

function getEmptyModeMessage(mode: StudyMode): string {
    if (mode === "learn") return "Mode Learn đang trống. Bộ này không còn card mới.";
    if (mode === "hard") return "Mode Hard cards đang trống. Chưa có card nào bị đánh dấu khó.";
    if (mode === "random") return "Không có card để xáo trộn trong mode Random.";
    return "Không có card trong mode Review.";
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

function getActiveCardsForMode(cards: StudyCard[], mode: StudyMode, seed: number): StudyCard[] {
    if (mode === "learn") {
        return cards.filter((card) => card.progress.status === "new");
    }

    if (mode === "hard") {
        return cards.filter((card) => card.progress.status === "learning");
    }

    if (mode === "random") {
        return shuffleCards(cards, seed);
    }

    return cards;
}

export default function StudyDeckPage() {
    const router = useRouter();
    const params = useParams<{ deckId: string }>();

    const deckId = typeof params.deckId === "string" ? params.deckId : "";

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
    
    // Isolate progress tracking for non-'learn' modes
    const [sessionTotalCards, setSessionTotalCards] = useState(0);
    const [sessionReviewedCards, setSessionReviewedCards] = useState(0);

    const currentCardStartedAtRef = useRef<number>(Date.now());

    const getModeLabel = (modeKey: StudyMode) => {
        const option = MODE_OPTIONS.find(m => m.key === modeKey);
        if (!option) return "";
        if (modeKey === "learn" && deckProgress?.reviewedCards === 0) {
            return "Bắt đầu học";
        }
        return option.label;
    };

    useEffect(() => {
        const saved = getStoredUsername();

        if (!saved) {
            router.replace("/login");
            return;
        }

        setUsername(saved);
    }, [router]);

    const loadProgressData = async (activeUsername: string, activeDeckId: string) => {
        const response = await fetch(
            `/api/progress/deck?username=${encodeURIComponent(activeUsername)}&deckId=${encodeURIComponent(activeDeckId)}`,
            { cache: "no-store" }
        );

        const payload = (await response.json()) as DeckProgressResponse | ApiError;
        if (!response.ok || !("deckId" in payload)) {
            throw new Error((payload as ApiError).error || "Không thể tải tiến độ của bộ");
        }

        setDeckProgress(payload as DeckProgressResponse);
    };

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

                const decksPayload = (await decksResponse.json()) as DeckSummary[] | ApiError;
                if (!decksResponse.ok || !Array.isArray(decksPayload)) {
                    const message = !Array.isArray(decksPayload) ? decksPayload.error : "Không thể tải bộ thẻ";
                    throw new Error(message || "Không thể tải bộ thẻ");
                }

                const selectedDeck = decksPayload.find((deck) => deck.id === deckId);
                if (!selectedDeck) {
                    throw new Error("Không tìm thấy bộ hoặc bạn không có quyền truy cập");
                }

                setDeckName(selectedDeck.name);

                const cardsPayload = (await cardsResponse.json()) as CardPayload[] | ApiError;
                if (!cardsResponse.ok || !Array.isArray(cardsPayload)) {
                    const message = !Array.isArray(cardsPayload) ? cardsPayload.error : "Không thể tải danh sách thẻ";
                    throw new Error(message || "Không thể tải danh sách thẻ");
                }

                setCards(cardsPayload.map(mapCard).filter((item) => item.content.hanzi));
                setIndex(0);
                setRandomSeed(Date.now());
                currentCardStartedAtRef.current = Date.now();

                await loadProgressData(username, deckId);
            } catch (loadError) {
                const message = loadError instanceof Error ? loadError.message : "Không thể tải bộ thẻ";
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };

        void loadData();
    }, [deckId, username]);

    const modeCounts = useMemo(
        () => ({
            learn: cards.filter((card) => card.progress.status === "new").length,
            review: cards.length,
            hard: cards.filter((card) => card.progress.status === "learning").length,
            random: cards.length,
        }),
        [cards]
    );

    const activeCards = useMemo(() => getActiveCardsForMode(cards, selectedMode, randomSeed), [cards, randomSeed, selectedMode]);

    const hasCards = activeCards.length > 0;
    const safeIndex = useMemo(() => (hasCards ? index % activeCards.length : 0), [activeCards.length, hasCards, index]);
    const currentCard = hasCards ? activeCards[safeIndex] : null;

    useEffect(() => {
        currentCardStartedAtRef.current = Date.now();
    }, [safeIndex, selectedMode]);

    const nextCard = () => {
        if (!hasCards) return;
        setIndex((prev) => prev + 1);
    };

    const previousCard = () => {
        if (!hasCards) return;
        setIndex((prev) => (prev - 1 + activeCards.length) % activeCards.length);
    };

    const handleModeChange = (mode: StudyMode) => {
        setSelectedMode(mode);
        if (mode === "random") {
            setRandomSeed(Date.now());
        }
        setIndex(0);
        currentCardStartedAtRef.current = Date.now();
        setStudyActive(true);

        // Reset local session progress when entering a mode
        if (mode !== "learn") {
            // Determine total cards for that mode upon entry
            const activeForMode = getActiveCardsForMode(cards, mode, randomSeed);
            setSessionTotalCards(activeForMode.length);
            setSessionReviewedCards(0);
        }
    };

    const submitReview = async (action: ReviewAction) => {
        if (!username || !deckId || !currentCard) return;

        setIsSubmittingReview(true);
        setError(null);

        try {
            const elapsedSeconds = Math.max(0, Math.round((Date.now() - currentCardStartedAtRef.current) / 1000));

            const response = await fetch("/api/review", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                    deckId,
                    cardId: currentCard.id,
                    action,
                    studySeconds: elapsedSeconds,
                }),
            });

            const payload = (await response.json()) as
                | {
                    cardId: string;
                    reviewCount: number;
                    lastReviewedAt: string;
                    status: CardStatus;
                    totalStudySeconds: number;
                }
                | ApiError;

            if (!response.ok || !("cardId" in payload)) {
                throw new Error((payload as ApiError).error || "Không thể lưu kết quả học");
            }

            const nextCards = cards.map((item) =>
                item.id === payload.cardId
                    ? {
                        ...item,
                        progress: {
                            reviewCount: payload.reviewCount,
                            lastReviewedAt: payload.lastReviewedAt,
                            status: payload.status,
                            totalStudySeconds: payload.totalStudySeconds,
                        },
                    }
                    : item
            );

            const nextActiveCards = getActiveCardsForMode(nextCards, selectedMode, randomSeed);
            const nextIndex = (() => {
                if (!nextActiveCards.length) {
                    return 0;
                }

                if (selectedMode === "learn") {
                    return Math.min(safeIndex, nextActiveCards.length - 1);
                }

                if (selectedMode === "hard" && payload.status !== currentCard.progress.status) {
                    return Math.min(safeIndex, nextActiveCards.length - 1);
                }

                return (safeIndex + 1) % nextActiveCards.length;
            })();

            setCards(nextCards);

            if (selectedMode !== "learn") {
                // Determine valid reviews (if a card was swiped easy/hard, track it in the session)
                setSessionReviewedCards((prev) => Math.min(prev + 1, sessionTotalCards));
            }

            // Always update global deck progress via API refetch to keep the data consistent
            await loadProgressData(username, deckId);
            setIndex(nextIndex);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Không thể lưu kết quả học";
            setError(message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleLogout = () => {
        clearStoredUsername();
        router.replace("/login");
    };

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
                                <button onClick={() => setStudyActive(false)} className="text-primary hover:opacity-80 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </button>
                            ) : (
                                <Link href="/flashcard" className="text-primary hover:opacity-80 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </Link>
                            )}
                            <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight max-w-[200px] truncate sm:max-w-xs">
                                {isViewingAll ? `Tất cả thẻ (${cards.length})` : studyActive ? getModeLabel(selectedMode) : deckName}
                            </h2>
                        </div>
                        <div className="flex justify-end gap-3 sm:gap-4">
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
                    Đang tải bộ thẻ...
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
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">style</span> {cards.length} thẻ</span>
                            {deckProgress && (
                                <span className="flex items-center gap-1 text-primary cursor-pointer" title={`${deckProgress.progressPercent}% hoàn thành`}>
                                    <span className="material-symbols-outlined text-[18px]">trending_up</span> {deckProgress.progressPercent}% hoàn thành
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Mode Selector Options Grid */}
                    <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                        {MODE_OPTIONS.map((mode) => {
                            const count = modeCounts[mode.key];
                            return (
                                <button
                                    key={mode.key}
                                    onClick={() => handleModeChange(mode.key)}
                                    className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl p-6 border border-primary/10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all gap-4 group"
                                >
                                    <div className="text-primary group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-[40px] leading-none">{mode.icon}</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{getModeLabel(mode.key)}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Preview Flashcards List */}
                    <div className="w-full mt-8">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Thẻ trong bộ ({cards.length})</h3>
                        <div className="space-y-3">
                            {cards.slice(0, 5).map(card => (
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
                                Xem tất cả {cards.length} thẻ
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* View All Cards Mode */}
            {!isLoading && !error && !studyActive && isViewingAll && (
                <div className="flex flex-col flex-1 px-4 py-6 lg:px-8 max-w-3xl mx-auto w-full items-center justify-start">
                    <div className="w-full space-y-3 pb-8">
                        {cards.map(card => (
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
                                    <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${formatStatusLabel(card.progress.status).className}`}>
                                        {formatStatusLabel(card.progress.status).label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Study View */}
            {!isLoading && !error && studyActive && (
                <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 lg:px-6 gap-6 relative">
                    {currentCard ? (
                        <>
                            <Flashcard
                                key={`${selectedMode}-${currentCard.id}-${safeIndex}`}
                                item={currentCard.content}
                                progress={currentCard.progress}
                                onNext={nextCard}
                                onSwipeLeft={() => void submitReview("hard")}
                                onSwipeRight={() => void submitReview("easy")}
                                isFlippingDisabled={isSubmittingReview}
                            />

                            {/* Learning Controls */}
                            <div className="w-full max-w-md flex items-center justify-between gap-6 pb-2">
                                <button
                                    type="button"
                                    onClick={() => void submitReview("hard")}
                                    disabled={isSubmittingReview}
                                    className="flex flex-1 flex-col items-center gap-2 group disabled:opacity-50"
                                >
                                    <div className="w-full h-14 flex items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/20 text-red-500 border border-red-200 dark:border-red-900/30 transition-all group-hover:-translate-x-1 group-active:scale-95 shadow-sm">
                                        <span className="material-symbols-outlined text-3xl">close</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Hard</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={nextCard}
                                    disabled={isSubmittingReview}
                                    className="flex flex-col items-center gap-2 group disabled:opacity-50 px-4"
                                >
                                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-active:scale-95 shadow-sm">
                                        <span className="material-symbols-outlined">skip_next</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Skip</span>
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
                                    <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Easy</span>
                                </button>
                            </div>
                        </>
                    ) : cards.length > 0 ? (
                        <section className="flex-1 flex w-full items-center justify-center p-6 text-center text-slate-500 font-medium">
                            {getEmptyModeMessage(selectedMode)}
                        </section>
                    ) : (
                        <section className="flex-1 flex w-full items-center justify-center p-6 text-center text-slate-500 font-medium">
                            Không có dữ liệu từ vựng trong bộ này.
                        </section>
                    )}
                </main>
            )}

            {/* Progress Bar Footer */}
            {studyActive && (
                <footer className="px-4 py-6 lg:px-6 border-t border-primary/5 mt-auto flex-none">
                    <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
                        <div className="flex justify-between items-center">
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tiến độ ({getModeLabel(selectedMode)})</p>
                            
                            {selectedMode === "learn" && deckProgress ? (
                                <p className="text-primary text-sm font-bold">{deckProgress.reviewedCards}/{deckProgress.totalCards} thẻ</p>
                            ) : (
                                <p className="text-primary text-sm font-bold">{sessionReviewedCards}/{sessionTotalCards} thẻ</p>
                            )}
                        </div>
                        <div className="relative h-2.5 w-full bg-primary/10 rounded-full overflow-hidden">
                            {selectedMode === "learn" && deckProgress ? (
                                <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(19,200,236,0.4)]" style={{ width: `${deckProgress.progressPercent}%` }}></div>
                            ) : (
                                <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(19,200,236,0.4)]" style={{ width: `${sessionTotalCards > 0 ? (sessionReviewedCards / sessionTotalCards) * 100 : 0}%` }}></div>
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