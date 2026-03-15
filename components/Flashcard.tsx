"use client";

import { TouchEvent, useRef, useState } from "react";
import AudioButton from "@/components/AudioButton";

export type VocabItem = {
    hanzi: string;
    pinyin: string;
    meaning: string;
    example: string;
    examplePinyin: string;
    exampleMeaning: string;
};

type FlashcardProps = {
    item: VocabItem;
    onNext?: () => void;
};

export default function Flashcard({ item, onNext }: FlashcardProps) {
    const [flipped, setFlipped] = useState(false);
    const touchStartX = useRef<number | null>(null);

    const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
    };

    const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
        if (touchStartX.current === null) return;

        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
        const deltaX = touchStartX.current - endX;
        touchStartX.current = null;

        if (Math.abs(deltaX) > 40 && onNext) {
            onNext();
        }
    };

    return (
        <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Flashcard</p>
                <AudioButton text={item.hanzi} />
            </div>

            <button
                type="button"
                onClick={() => setFlipped((prev) => !prev)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 text-center transition"
                style={{ perspective: "1000px" }}
            >
                <div
                    className="relative h-72 w-full duration-300"
                    style={{
                        transformStyle: "preserve-3d",
                        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                >
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-xl p-6"
                        style={{ backfaceVisibility: "hidden" }}
                    >
                        <p className="text-7xl font-semibold tracking-wide text-slate-900">{item.hanzi}</p>
                        <p className="mt-4 text-xl font-medium text-slate-600">{item.pinyin}</p>
                        <p className="mt-4 text-sm text-slate-500">Tap to flip • Swipe to next</p>
                    </div>

                    <div
                        className="absolute inset-0 overflow-y-auto rounded-xl bg-white p-6 text-left"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Meaning</p>
                        <p className="mt-1 text-lg text-teal-700">{item.meaning}</p>

                        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Example</p>
                        <p className="mt-1 text-base text-slate-800">{item.example}</p>

                        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Example Pinyin</p>
                        <p className="mt-1 text-base text-slate-700">{item.examplePinyin}</p>

                        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Example Meaning</p>
                        <p className="mt-1 text-base text-slate-700">{item.exampleMeaning}</p>
                    </div>
                </div>
            </button>
        </article>
    );
}
