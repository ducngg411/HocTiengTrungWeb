"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Flashcard, { VocabItem } from "@/components/Flashcard";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";

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
type ReviewGrade = "hard" | "good" | "easy";

type CardProgress = {
    reviewCount: number;
    lastReviewedAt: string | null;
    nextReviewAt: string | null;
    easeFactor: number;
    status: CardStatus;
    difficulty: "hard" | "medium" | "easy";
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
    dueCards: number;
    progressPercent: number;
    masteredProgressPercent: number;
    hardCards: Array<{
        cardId: string;
        reviewCount: number;
        status: CardStatus;
        easeFactor: number;
        difficulty: "hard" | "medium" | "easy";
        lastReviewedAt: string | null;
        nextReviewAt: string | null;
    }>;
};

type StudyCard = {
    id: string;
    content: VocabItem;
    progress: CardProgress;
};

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

function formatStatusLabel(status: CardStatus): string {
    if (status === "new") return "mới";
    if (status === "learning") return "đang học";
    return "đã nhớ vững";
}

function formatDifficultyLabel(level: "hard" | "medium" | "easy"): string {
    if (level === "hard") return "khó";
    if (level === "medium") return "trung bình";
    return "dễ";
}

export default function StudyDeckPage() {
    const router = useRouter();
    const params = useParams<{ deckId: string }>();

    const deckId = typeof params.deckId === "string" ? params.deckId : "";

    const [username, setUsername] = useState("");
    const [deckName, setDeckName] = useState("Deck");
    const [cards, setCards] = useState<StudyCard[]>([]);
    const [deckProgress, setDeckProgress] = useState<DeckProgressResponse | null>(null);
    const [index, setIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentCardStartedAtRef = useRef<number>(Date.now());

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

    useEffect(() => {
        currentCardStartedAtRef.current = Date.now();
    }, [index]);

    const hasCards = cards.length > 0;
    const safeIndex = useMemo(() => (hasCards ? index % cards.length : 0), [hasCards, index, cards.length]);
    const currentCard = hasCards ? cards[safeIndex] : null;

    const nextCard = () => {
        if (!hasCards) return;
        setIndex((prev) => (prev + 1) % cards.length);
    };

    const previousCard = () => {
        if (!hasCards) return;
        setIndex((prev) => (prev - 1 + cards.length) % cards.length);
    };

    const submitReview = async (grade: ReviewGrade) => {
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
                    grade,
                    studySeconds: elapsedSeconds,
                }),
            });

            const payload = (await response.json()) as
                | {
                    cardId: string;
                    reviewCount: number;
                    lastReviewedAt: string;
                    nextReviewAt: string;
                    easeFactor: number;
                    status: CardStatus;
                    difficulty: "hard" | "medium" | "easy";
                    totalStudySeconds: number;
                }
                | ApiError;

            if (!response.ok || !("cardId" in payload)) {
                throw new Error((payload as ApiError).error || "Không thể lưu kết quả ôn tập");
            }

            setCards((prev) =>
                prev.map((item) =>
                    item.id === (payload as { cardId: string }).cardId
                        ? {
                            ...item,
                            progress: {
                                reviewCount: (payload as { reviewCount: number }).reviewCount,
                                lastReviewedAt: (payload as { lastReviewedAt: string }).lastReviewedAt,
                                nextReviewAt: (payload as { nextReviewAt: string }).nextReviewAt,
                                easeFactor: (payload as { easeFactor: number }).easeFactor,
                                status: (payload as { status: CardStatus }).status,
                                difficulty: (payload as { difficulty: "hard" | "medium" | "easy" }).difficulty,
                                totalStudySeconds: (payload as { totalStudySeconds: number }).totalStudySeconds,
                            },
                        }
                        : item
                )
            );

            await loadProgressData(username, deckId);
            nextCard();
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Không thể lưu kết quả ôn tập";
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
        <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">{deckName}</h1>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Đăng xuất
                    </button>
                </div>
                <p className="mt-1 text-sm text-slate-600">Chạm để lật thẻ, sau đó chọn mức độ để cập nhật lịch ôn tập.</p>
                <Link href="/flashcard" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
                    Quay Lại Dashboard
                </Link>
            </header>

            {isLoading && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    Đang tải bộ thẻ...
                </section>
            )}

            {!isLoading && error && (
                <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                    {error}
                </section>
            )}

            {!isLoading && deckProgress && (
                <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">Tiến Độ Theo Bộ</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Tiến Độ</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{deckProgress.progressPercent}%</p>
                            <p className="text-xs text-slate-500">
                                Đã học {deckProgress.reviewedCards} / {deckProgress.totalCards}
                            </p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Hôm Nay Đã Học</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{deckProgress.todayStudied}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Thẻ Đến Hạn Ôn</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{deckProgress.dueCards}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Đã Nhớ Vững</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{deckProgress.masteredCards}</p>
                            <p className="text-xs text-slate-500">{deckProgress.masteredProgressPercent}% của bộ</p>
                        </article>
                    </div>
                </section>
            )}

            {!isLoading && !error && currentCard && (
                <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div>
                        <Flashcard key={`${safeIndex}-${currentCard.content.hanzi}`} item={currentCard.content} onNext={nextCard} />

                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={previousCard}
                                disabled={isSubmittingReview}
                                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Lùi
                            </button>
                            <button
                                type="button"
                                onClick={nextCard}
                                disabled={isSubmittingReview}
                                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Bỏ qua
                            </button>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <button
                                type="button"
                                onClick={() => void submitReview("hard")}
                                disabled={isSubmittingReview}
                                className="rounded-xl border border-rose-500 bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
                            >
                                Khó
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitReview("good")}
                                disabled={isSubmittingReview}
                                className="rounded-xl border border-amber-500 bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                                Tốt
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitReview("easy")}
                                disabled={isSubmittingReview}
                                className="rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Dễ
                            </button>
                        </div>

                        <p className="mt-3 text-center text-sm text-slate-500">
                            {safeIndex + 1} / {cards.length}
                        </p>
                    </div>

                    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">Tiến Độ Thẻ Hiện Tại</h2>
                        <div className="mt-3 grid gap-2 text-sm text-slate-700">
                            <p>
                                <span className="font-semibold">Trạng thái:</span> {formatStatusLabel(currentCard.progress.status)}
                            </p>
                            <p>
                                <span className="font-semibold">Độ khó:</span> {formatDifficultyLabel(currentCard.progress.difficulty)}
                            </p>
                            <p>
                                <span className="font-semibold">Số lần ôn:</span> {currentCard.progress.reviewCount}
                            </p>
                            <p>
                                <span className="font-semibold">Lần ôn gần nhất:</span> {formatDate(currentCard.progress.lastReviewedAt)}
                            </p>
                            <p>
                                <span className="font-semibold">Lần ôn tiếp theo:</span> {formatDate(currentCard.progress.nextReviewAt)}
                            </p>
                            <p>
                                <span className="font-semibold">Hệ số dễ nhớ:</span> {currentCard.progress.easeFactor.toFixed(2)}
                            </p>
                        </div>

                        {deckProgress?.hardCards.length ? (
                            <div className="mt-4">
                                <h3 className="text-sm font-semibold text-slate-900">Những Thẻ Khó Nhất</h3>
                                <ul className="mt-2 space-y-2">
                                    {deckProgress.hardCards.slice(0, 5).map((item) => {
                                        const card = cards.find((entry) => entry.id === item.cardId);

                                        return (
                                            <li key={item.cardId} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-600">
                                                <p className="font-semibold text-slate-800">{card?.content.hanzi ?? "Thẻ"}</p>
                                                <p>Độ khó: {formatDifficultyLabel(item.difficulty)}</p>
                                                <p>Số lần ôn: {item.reviewCount}</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : null}
                    </aside>
                </section>
            )}

            {!isLoading && !error && !currentCard && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    Không có dữ liệu từ vựng trong bộ này.
                </section>
            )}
        </main>
    );
}
