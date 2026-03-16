"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStoredUsername } from "@/lib/client-auth";

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
        <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900">Tạo Bộ Flashcard Từ Google Sheets</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Chọn 1 tab cụ thể trong Google Sheet để tạo bộ flashcard.
                </p>
                <Link href="/flashcard" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
                    Quay Lại Dashboard
                </Link>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3">
                    <input
                        value={deckName}
                        onChange={(event) => setDeckName(event.target.value)}
                        placeholder="Tên bộ flashcard"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring"
                    />

                    <input
                        value={deckDescription}
                        onChange={(event) => setDeckDescription(event.target.value)}
                        placeholder="Mô tả (không bắt buộc)"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring"
                    />

                    <input
                        value={sheetUrl}
                        onChange={(event) => {
                            setSheetUrl(event.target.value);
                            setSheetTabs([]);
                            setSelectedSheetTab("");
                        }}
                        placeholder="Link Google Sheet"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring"
                    />

                    <button
                        type="button"
                        onClick={detectSheetTabs}
                        disabled={!sheetUrl || isDetectingTabs}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        {isDetectingTabs ? "Đang quét tab..." : "Quét Tab Trong Sheet"}
                    </button>

                    {!!sheetTabs.length && (
                        <select
                            value={selectedSheetTab}
                            onChange={(event) => setSelectedSheetTab(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring"
                        >
                            {sheetTabs.map((tab) => (
                                <option key={tab} value={tab}>
                                    {tab}
                                </option>
                            ))}
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={createDeck}
                        disabled={!deckName || !sheetUrl || !selectedSheetTab || isCreatingDeck}
                        className="rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isCreatingDeck ? "Đang tạo bộ..." : "Tạo Bộ Flashcard"}
                    </button>
                </div>

                {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
            </section>
        </main>
    );
}
