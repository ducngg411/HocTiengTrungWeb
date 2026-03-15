"use client";

import { useEffect, useMemo, useState } from "react";
import Flashcard, { VocabItem } from "@/components/Flashcard";
import type { Vocab } from "@/services/vocabulary";

function mapVocabToFlashcard(item: Vocab): VocabItem {
    return {
        hanzi: item.word,
        pinyin: item.pinyin,
        meaning: item.meaning,
        example: item.example,
        examplePinyin: item.examplePinyin,
        exampleMeaning: item.exampleMeaning,
    };
}

export default function FlashcardPage() {
    const [words, setWords] = useState<VocabItem[]>([]);
    const [index, setIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadVocabulary = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/vocabulary", { cache: "no-store" });
                const payload = (await response.json()) as Vocab[] | { error?: string };

                if (!response.ok || !Array.isArray(payload)) {
                    const message = !Array.isArray(payload) ? payload.error : "Failed to load vocabulary";
                    throw new Error(message || "Failed to load vocabulary");
                }

                const mapped = payload.map(mapVocabToFlashcard).filter((item) => item.hanzi);
                setWords(mapped);
            } catch (fetchError) {
                const message = fetchError instanceof Error ? fetchError.message : "Failed to load vocabulary";
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };

        void loadVocabulary();
    }, []);

    const hasWords = words.length > 0;
    const safeIndex = useMemo(() => (hasWords ? index % words.length : 0), [hasWords, index, words.length]);

    const nextCard = () => {
        if (!hasWords) return;
        setIndex((prev) => (prev + 1) % words.length);
    };

    const previousCard = () => {
        if (!hasWords) return;
        setIndex((prev) => (prev - 1 + words.length) % words.length);
    };

    return (
        <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900">Chinese Flashcards</h1>
                <p className="mt-1 text-sm text-slate-600">Tap to flip. Swipe left or tap Next to continue.</p>
            </header>

            {isLoading && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    Loading vocabulary...
                </section>
            )}

            {!isLoading && error && (
                <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
                    {error}
                </section>
            )}

            {!isLoading && !error && hasWords && (
                <Flashcard key={`${safeIndex}-${words[safeIndex].hanzi}`} item={words[safeIndex]} onNext={nextCard} />
            )}

            {!isLoading && !error && !hasWords && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                    No vocabulary rows found in this sheet range.
                </section>
            )}

            <div className="mt-4 flex gap-3">
                <button
                    type="button"
                    onClick={previousCard}
                    disabled={!hasWords || isLoading}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                    Previous
                </button>
                <button
                    type="button"
                    onClick={nextCard}
                    disabled={!hasWords || isLoading}
                    className="flex-1 rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                    Next
                </button>
            </div>

            {hasWords && (
                <p className="mt-3 text-center text-sm text-slate-500">
                    {safeIndex + 1} / {words.length}
                </p>
            )}
        </main>
    );
}
