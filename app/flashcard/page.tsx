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

        const shouldDelete = window.confirm(`Xóa bộ \"${deckName}\"? Tất cả thẻ và tiến độ liên quan sẽ bị xóa.`);
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
        <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Bảng Điều Khiển Flashcard</h1>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Đăng xuất
                    </button>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                    Đăng nhập với <span className="font-semibold text-slate-900">{username || "..."}</span>
                </p>
            </header>

            {isLoading && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    Đang tải dashboard...
                </section>
            )}

            {!isLoading && error && (
                <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                    {error}
                </section>
            )}

            {!isLoading && userProgress && (
                <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">Tiến Độ Tổng Quan</h2>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Tổng Số Bộ</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{userProgress.totalDecks}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Hôm Nay Đã Học</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{userProgress.todayStudiedCards}</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Chuỗi Ngày Học</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{userProgress.streak} ngày</p>
                        </article>
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Tổng Thời Gian Học</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{userProgress.totalStudyTimeLabel}</p>
                        </article>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-sm font-semibold text-slate-900">Tiến Độ Tổng Thể</p>
                            <p className="mt-1 text-sm text-slate-600">
                                Đã học {userProgress.reviewedCards} / {userProgress.totalCards} thẻ ({userProgress.overallProgressPercent}%)
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Đã nhớ vững: {userProgress.masteredCards} ({userProgress.masteredProgressPercent}%)
                            </p>
                            <div className="mt-3 h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                                            {pieData.map((entry, idx) => (
                                                <Cell key={`${entry.name}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="rounded-xl border border-slate-200 p-3">
                            <p className="text-sm font-semibold text-slate-900">So Sánh Tiến Độ Từng Bộ</p>
                            <p className="mt-1 text-sm text-slate-600">Tỷ lệ thẻ đã học (%) của mỗi bộ</p>
                            <div className="mt-3 h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={userProgress.deckStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="deckName" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="progressPercent" fill="#0d9488" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>
                    </div>
                </section>
            )}

            <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Tạo Bộ Mới</h2>
                        <p className="mt-1 text-sm text-slate-600">Mở màn hình riêng để import từ Google Sheets.</p>
                    </div>
                    <Link
                        href="/flashcard/create"
                        className="rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                        Tạo Bộ
                    </Link>
                </div>
            </section>

            {!isLoading && !error && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">Tiến Độ Từng Bộ</h2>

                    {!decks.length && <p className="mt-2 text-sm text-slate-600">Bạn chưa có bộ nào. Hãy tạo bộ đầu tiên ở trên.</p>}

                    {!!decks.length && (
                        <ul className="mt-3 space-y-3">
                            {decks.map((deck) => {
                                const stat = userProgress?.deckStats.find((item) => item.deckId === deck.id);
                                const progressPercent = stat?.progressPercent ?? 0;

                                return (
                                    <li key={deck.id} className="rounded-xl border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-slate-900">{deck.name}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {deck.cardCount} thẻ • Tab: {deck.sheetName}
                                                </p>
                                                {deck.description && <p className="mt-1 text-sm text-slate-600">{deck.description}</p>}
                                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${progressPercent}%` }} />
                                                </div>
                                                <p className="mt-1 text-xs text-slate-600">
                                                    Tiến độ: {progressPercent}% • Đã học: {stat?.reviewedCards ?? 0}/{stat?.totalCards ?? deck.cardCount}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Đã nhớ vững: {stat?.masteredCards ?? 0}/{stat?.totalCards ?? deck.cardCount} ({stat?.masteredProgressPercent ?? 0}%)
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Link
                                                    href={`/flashcard/study/${deck.id}`}
                                                    className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-teal-700"
                                                >
                                                    Học
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => void deleteDeck(deck.id, deck.name)}
                                                    disabled={deletingDeckId === deck.id}
                                                    className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                                                >
                                                    {deletingDeckId === deck.id ? "Đang xóa..." : "Xóa"}
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}
        </main>
    );
}
