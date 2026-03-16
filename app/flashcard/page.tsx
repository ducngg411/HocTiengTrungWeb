"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type DeckSummary = {
    id: string;
    name: string;
    description: string;
    sheetName: string;
    cardCount: number;
    createdAt: string;
};

type UserDeckProgress = {
    deckId: string;
    deckName: string;
    totalCards: number;
    reviewedCards: number;
    masteredCards: number;
    progressPercent: number;
    masteredProgressPercent: number;
    todayStudied: number;
};

type UserProgressResponse = {
    totalDecks: number;
    totalCards: number;
    reviewedCards: number;
    masteredCards: number;
    overallProgressPercent: number;
    masteredProgressPercent: number;
    todayStudiedCards: number;
    streak: number;
    totalStudySeconds: number;
    totalStudyTimeLabel: string;
    totalCardsReviewed: number;
    deckStats: UserDeckProgress[];
};

type ApiError = {
    error?: string;
};

const PIE_COLORS = ["#0d9488", "#14b8a6"];

export default function FlashcardDeckPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [decks, setDecks] = useState<DeckSummary[]>([]);
    const [userProgress, setUserProgress] = useState<UserProgressResponse | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const saved = getStoredUsername();

        if (!saved) {
            router.replace("/login");
            return;
        }

        setUsername(saved);
    }, [router]);

    const loadDashboardData = async (activeUsername: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const [decksResponse, progressResponse] = await Promise.all([
                fetch(`/api/decks?username=${encodeURIComponent(activeUsername)}`, { cache: "no-store" }),
                fetch(`/api/progress/user?username=${encodeURIComponent(activeUsername)}`, { cache: "no-store" }),
            ]);

            const decksPayload = (await decksResponse.json()) as DeckSummary[] | ApiError;
            if (!decksResponse.ok || !Array.isArray(decksPayload)) {
                const message = !Array.isArray(decksPayload) ? decksPayload.error : "Không thể tải danh sách bộ";
                throw new Error(message || "Không thể tải danh sách bộ");
            }

            const progressPayload = (await progressResponse.json()) as UserProgressResponse | ApiError;
            if (!progressResponse.ok || !("totalDecks" in progressPayload)) {
                throw new Error((progressPayload as ApiError).error || "Không thể tải tiến độ học");
            }

            setDecks(decksPayload);
            setUserProgress(progressPayload as UserProgressResponse);
        } catch (fetchError) {
            const message = fetchError instanceof Error ? fetchError.message : "Không thể tải dashboard";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!username) return;
        void loadDashboardData(username);
    }, [username]);

    const deleteDeck = async (deckId: string, deckName: string) => {
        if (!username) return;

        const shouldDelete = window.confirm(t("common.delete") + ` "${deckName}"?`);
        if (!shouldDelete) return;

        setDeletingDeckId(deckId);
        setError(null);

        try {
            const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}?username=${encodeURIComponent(username)}`, {
                method: "DELETE",
            });

            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
                throw new Error(payload.error || "Xóa bộ flashcard thất bại");
            }

            await loadDashboardData(username);
        } catch (deleteError) {
            const message = deleteError instanceof Error ? deleteError.message : "Xóa bộ flashcard thất bại";
            setError(message);
        } finally {
            setDeletingDeckId(null);
        }
    };

    const handleLogout = () => {
        clearStoredUsername();
        router.replace("/login");
    };

    const pieData = userProgress
        ? [
            { name: "Đã học", value: userProgress.reviewedCards },
            { name: "Chưa học", value: Math.max(userProgress.totalCards - userProgress.reviewedCards, 0) },
        ]
        : [];

    return (
        <div className="relative flex min-h-screen flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/20 text-primary">
                                <span className="material-symbols-outlined">translate</span>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Học Tiếng Trung</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="p-2 text-slate-500 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors">
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                            <button className="p-2 text-slate-500 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            <LanguageSwitcher />
                            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="group flex items-center gap-3 pl-2 transition-opacity hover:opacity-80"
                            >
                                <div className="hidden sm:block text-right">
                                    <p className="text-sm font-semibold">{username || t("dashboard.defaultUser")}</p>
                                    <p className="text-xs text-slate-500">{t("dashboard.learner")}</p>
                                </div>
                                <div className="size-10 rounded-full bg-primary/30 border-2 border-primary overflow-hidden flex items-center justify-center text-primary font-bold">
                                    {username ? username.charAt(0).toUpperCase() : "U"}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

            {isLoading && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    {t("common.loading")}
                </section>
            )}

            {!isLoading && error && (
                <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                    {error}
                </section>
            )}

            {/* Header Section */}
            {!isLoading && !error && userProgress && (
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 mt-4">
                    <div>
                        <h2 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t("dashboard.myDecks")}</h2>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md">
                            {t("dashboard.learningActivity")}
                        </p>
                    </div>
                    <Link
                        href="/flashcard/create"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        <span>{t("dashboard.createDeck")}</span>
                    </Link>
                </div>
            )}

            {/* Stats Overview */}
            {!isLoading && userProgress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 shadow-sm">
                        <p className="text-slate-500 text-sm font-medium">{t("dashboard.stats.totalWords")}</p>
                        <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{userProgress.totalCards}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 shadow-sm">
                        <p className="text-slate-500 text-sm font-medium">{t("dashboard.stats.wordsLearned")}</p>
                        <p className="text-2xl font-bold mt-1 text-primary">{userProgress.reviewedCards}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 shadow-sm">
                        <p className="text-slate-500 text-sm font-medium">{t("dashboard.stats.streak")}</p>
                        <div className="flex items-center gap-2 mt-1 text-slate-900 dark:text-slate-100">
                            <p className="text-2xl font-bold">{userProgress.streak} {t("dashboard.stats.days")}</p>
                            <span className="material-symbols-outlined text-orange-400">local_fire_department</span>
                        </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-primary/5 shadow-sm">
                        <p className="text-slate-500 text-sm font-medium">{t("dashboard.stats.goal")}</p>
                        <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{userProgress.masteredProgressPercent}%</p>
                    </div>
                </div>
            )}



            {!isLoading && !error && (
                <div className="mb-10">
                    {!decks.length && <p className="mt-2 text-sm text-slate-600">{t("dashboard.emptyDecks")}</p>}

                    {!!decks.length && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {decks.map((deck) => {
                                const stat = userProgress?.deckStats.find((item) => item.deckId === deck.id);
                                const progressPercent = stat?.progressPercent ?? 0;
                                const masteredPercent = stat?.masteredProgressPercent ?? 0;

                                return (
                                    <div key={deck.id} className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-primary/10 hover:border-primary/40 transition-all shadow-sm hover:shadow-xl">
                                        <div className="h-40 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                                            <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:scale-110 transition-transform duration-500">
                                                <span className="material-symbols-outlined text-[80px]">school</span>
                                            </div>
                                            <div className="absolute bottom-4 left-4">
                                                <span className="px-3 py-1 bg-primary/90 text-slate-900 text-xs font-bold rounded-full">{deck.sheetName}</span>
                                            </div>
                                        </div>
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{deck.name}</h3>
                                                <button 
                                                    onClick={() => void deleteDeck(deck.id, deck.name)}
                                                    disabled={deletingDeckId === deck.id}
                                                    className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                    title="Xoá bộ này"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                            <p className="text-sm text-slate-500 mb-6 line-clamp-2 min-h-[40px]">
                                                {deck.description || t("dashboard.noDescription")}
                                            </p>
                                            
                                            <div className="space-y-3 mt-auto">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="text-slate-500 line-clamp-1 flex-1 mr-2">{t("dashboard.stats.wordsLearned")}</span>
                                                    <span className="text-primary truncate">{stat?.reviewedCards ?? 0} / {stat?.totalCards ?? deck.cardCount} {t("dashboard.deck.cards")}</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div>
                                                </div>
                                                
                                                <div className="flex justify-between text-xs font-medium mt-1">
                                                    <span className="text-slate-400 line-clamp-1 flex-1 mr-2">{t("dashboard.deck.progress")}</span>
                                                    <span className="text-emerald-500 truncate">{stat?.masteredCards ?? 0} / {stat?.totalCards ?? deck.cardCount} ({masteredPercent}%)</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 w-full mt-6">
                                                <Link href={`/flashcard/study/${deck.id}`} className="flex-1 py-3 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined">play_arrow</span>
                                                    {t("dashboard.deck.studyNow")}
                                                </Link>
                                                <Link href={`/flashcard/practice/${deck.id}`} className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-500 text-indigo-600 hover:text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined">edit_square</span>
                                                    {t("dashboard.deck.practice")}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </main>
        </div>
    );
}
