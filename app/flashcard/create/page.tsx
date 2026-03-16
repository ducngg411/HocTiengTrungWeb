"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredUsername, getStoredUsername } from "@/lib/client-auth";

export default function CreateDeckPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [deckName, setDeckName] = useState("");
    const [deckDescription, setDeckDescription] = useState("");
    const [sheetUrl, setSheetUrl] = useState("");
    const [sheetTabs, setSheetTabs] = useState<string[]>([]);
    const [selectedSheetTab, setSelectedSheetTab] = useState("");
    const [isDetectingTabs, setIsDetectingTabs] = useState(false);
    const [isCreatingDeck, setIsCreatingDeck] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hardcode UI states cho Source Type (hiện tại backend chỉ hỗ trợ GSheet nên ta mặc định chọn 1)
    const [sourceType, setSourceType] = useState<"sheets" | "manual">("sheets");

    useEffect(() => {
        const saved = getStoredUsername();

        if (!saved) {
            router.replace("/login");
            return;
        }

        setUsername(saved);
    }, [router]);

    const detectSheetTabs = async () => {
        setIsDetectingTabs(true);
        setError(null);

        try {
            const response = await fetch("/api/sheets/tabs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sheetUrl }),
            });

            const payload = (await response.json()) as { sheets?: string[]; error?: string };
            if (!response.ok || !Array.isArray(payload.sheets)) {
                throw new Error(payload.error || "Không thể lấy danh sách tab trong sheet");
            }

            setSheetTabs(payload.sheets);
            setSelectedSheetTab(payload.sheets[0] ?? "");
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Không thể lấy danh sách tab trong sheet";
            setError(message);
        } finally {
            setIsDetectingTabs(false);
        }
    };

    const createDeck = async () => {
        if (!username) return;

        setIsCreatingDeck(true);
        setError(null);

        try {
            const response = await fetch("/api/decks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                    name: deckName,
                    description: deckDescription,
                    sheetUrl,
                    sheetName: selectedSheetTab,
                }),
            });

            const payload = (await response.json()) as { id?: string; error?: string };
            if (!response.ok || !payload.id) {
                throw new Error(payload.error || "Tạo bộ flashcard thất bại");
            }

            router.replace("/flashcard");
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Tạo bộ flashcard thất bại";
            setError(message);
        } finally {
            setIsCreatingDeck(false);
        }
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            <div className="layout-container flex h-full grow flex-col">
                <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md flex flex-none items-center justify-between whitespace-nowrap border-b border-primary/10 px-4 py-4 lg:px-6">
                    <div className="flex items-center gap-4">
                        <Link href="/flashcard" className="text-primary hover:opacity-80 transition-opacity">
                            <span className="material-symbols-outlined text-3xl">arrow_back</span>
                        </Link>
                        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight max-w-[200px] truncate sm:max-w-xs">
                            Thêm Bộ Thẻ Mới
                        </h2>
                    </div>
                    <div className="flex justify-end gap-3 sm:gap-4">
                        <div className="flex gap-2">
                            <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-primary/10 text-slate-900 dark:text-slate-100 transition-colors hover:bg-primary/20">
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                        </div>
                        <button onClick={() => {
                            clearStoredUsername();
                            router.replace("/login");
                        }} className="aspect-square rounded-full size-10 bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/30 text-primary font-bold transition-opacity hover:opacity-80">
                            {username ? username.charAt(0).toUpperCase() : "U"}
                        </button>
                    </div>
                </header>

                <main className="flex flex-1 justify-center py-8 px-4 lg:px-0">
                    <div className="layout-content-container flex flex-col max-w-[640px] w-full flex-1 gap-8">
                        {/* Title Section */}
                        <div className="flex flex-col gap-2 px-4">
                            <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold leading-tight">Xây dựng bộ thẻ của bạn</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-base">Nhập thông tin chi tiết để bắt đầu học Tiếng Trung theo lộ trình tuỳ chỉnh.</p>
                        </div>

                        {/* Form Section */}
                        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-primary/10 pb-8">
                            {/* Deck Name Input */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal">Tên Bộ Thẻ</label>
                                <input
                                    value={deckName}
                                    onChange={(event) => setDeckName(event.target.value)}
                                    className="form-input flex w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 h-12 px-4 text-base transition-all outline-none"
                                    placeholder="Ví dụ: HSK 1 Core Vocabulary"
                                    type="text"
                                />
                            </div>

                            {/* Description Textarea */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal">Mô tả chi tiết</label>
                                <textarea
                                    value={deckDescription}
                                    onChange={(event) => setDeckDescription(event.target.value)}
                                    className="form-input flex w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-24 p-4 text-base transition-all outline-none resize-none"
                                    placeholder="Chủ đề và cấp độ từ vựng trong bộ này là gì?"
                                ></textarea>
                            </div>

                            {/* Source Type Selector */}
                            <div className="flex flex-col gap-3">
                                <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal">Nguồn Dữ Liệu</label>
                                <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-primary bg-primary/5 text-primary font-medium w-fit pr-6">
                                    <span className="material-symbols-outlined text-xl">table_chart</span>
                                    <span>Google Sheets</span>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                                    <span className="material-symbols-outlined text-[18px]">error</span>
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            {sourceType === "sheets" && (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Google Sheets Link Input */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal">Đường dẫn Google Sheets</label>
                                            <a className="text-primary text-xs font-medium hover:underline" href="#" title="Chia sẻ trang tính ở chế độ: Bất kỳ ai có liên kết đều có thể xem">Chia sẻ thế nào?</a>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="relative flex-1">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">link</span>
                                                <input
                                                    value={sheetUrl}
                                                    onChange={(event) => {
                                                        setSheetUrl(event.target.value);
                                                        setSheetTabs([]);
                                                        setSelectedSheetTab("");
                                                    }}
                                                    className="form-input flex w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 h-12 pl-10 pr-4 text-base outline-none transition-all"
                                                    placeholder="https://docs.google.../edit#gid=0"
                                                    type="url"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={detectSheetTabs}
                                                disabled={!sheetUrl || isDetectingTabs}
                                                className="sm:w-auto w-full flex-none items-center justify-center h-12 gap-2 rounded-lg bg-slate-100 dark:bg-slate-700 px-6 font-bold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 disabled:opacity-50"
                                            >
                                                {isDetectingTabs ? "Đang quét..." : "Quét Tabs"}
                                            </button>
                                        </div>
                                        <p className="text-slate-400 text-xs mt-1 italic">Đảm bảo trang tính đang được thiết lập "Bất kỳ ai có đường liên kết đều có thể xem".</p>
                                    </div>
                                    
                                    {/* Sheet Tabs Dropdown */}
                                    {!!sheetTabs.length && (
                                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-slate-900 dark:text-slate-100 text-sm font-semibold leading-normal">Chọn Tab Dữ Liệu</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">view_list</span>
                                                <select
                                                    value={selectedSheetTab}
                                                    onChange={(event) => setSelectedSheetTab(event.target.value)}
                                                    className="appearance-none form-input flex w-full rounded-lg border border-primary/30 bg-primary/5 text-primary font-bold focus:border-primary focus:ring-4 focus:ring-primary/20 focus:bg-primary/10 h-12 pl-10 pr-10 text-base outline-none transition-all"
                                                >
                                                    {sheetTabs.map((tab) => (
                                                        <option key={tab} value={tab} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 font-medium">
                                                            {tab}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-primary">
                                                    <span className="material-symbols-outlined text-xl">expand_more</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 px-4 pb-6">
                            <button
                                type="button"
                                onClick={createDeck}
                                disabled={!deckName || !sheetUrl || !selectedSheetTab || isCreatingDeck}
                                className="flex w-full cursor-pointer items-center justify-center rounded-xl h-14 bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
                            >
                                {isCreatingDeck ? (
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined animate-spin hidden sm:inline-block">sync</span>
                                        Đang tạo...
                                    </span>
                                ) : (
                                    "Tạo Bộ Thẻ Mới"
                                )}
                            </button>
                            <Link
                                href="/flashcard"
                                className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 bg-transparent text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                                Tuỳ chọn và quay lại sau
                            </Link>
                        </div>

                        {/* Tips Section */}
                        <div className="mx-4 mb-10 p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-4">
                            <span className="material-symbols-outlined text-primary">lightbulb</span>
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">Mẹo hữu ích</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Đảm bảo bạn có ít nhất 3 cột chuẩn trong dòng đầu tiên của Google Sheets: <span className="font-mono bg-white/60 dark:bg-black/20 px-1 py-0.5 rounded text-primary">Hanzi</span>, <span className="font-mono bg-white/60 dark:bg-black/20 px-1 py-0.5 rounded text-primary">Pinyin</span>, và <span className="font-mono bg-white/60 dark:bg-black/20 px-1 py-0.5 rounded text-primary">Meaning</span>.
                                </p>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
