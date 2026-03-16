"use client";

import { MouseEvent, PointerEvent, TouchEvent, useEffect, useRef, useState } from "react";
import AudioButton from "@/components/AudioButton";

export type VocabItem = {
    hanzi: string;
    pinyin: string;
    meaning: string;
    example: string;
    examplePinyin: string;
    exampleMeaning: string;
};

type CardStatus = "new" | "learning" | "mastered";

type CardProgress = {
    reviewCount: number;
    lastReviewedAt: string | null;
    status: CardStatus;
    totalStudySeconds: number;
};

type FlashcardProps = {
    item: VocabItem;
    progress?: CardProgress;
    onNext?: () => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    isFlippingDisabled?: boolean;
};

export default function Flashcard({ item, progress, onNext, onSwipeLeft, onSwipeRight, isFlippingDisabled }: FlashcardProps) {
    const [flipped, setFlipped] = useState(false);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [flyOutDirection, setFlyOutDirection] = useState<"left" | "right" | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const pointerStartX = useRef<number | null>(null);
    const pointerStartY = useRef<number | null>(null);
    const suppressClick = useRef(false);

    useEffect(() => {
        setFlipped(false);
        setDragOffsetX(0);
        setIsDragging(false);
        setFlyOutDirection(null);
    }, [item.hanzi, item.meaning, item.pinyin]);

    const resetGesture = () => {
        touchStartX.current = null;
        touchStartY.current = null;
        pointerStartX.current = null;
        pointerStartY.current = null;
        setIsDragging(false);
    };

    const animateFlyOut = (direction: "left" | "right") => {
        suppressClick.current = true;
        setIsDragging(false);
        setFlyOutDirection(direction);
        setDragOffsetX(direction === "left" ? -420 : 420);

        window.setTimeout(() => {
            if (direction === "left") {
                onSwipeLeft?.();
            } else {
                onSwipeRight?.();
            }

            setFlyOutDirection(null);
            setDragOffsetX(0);
        }, 220);
    };

    const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        touchStartY.current = event.touches[0]?.clientY ?? null;
        suppressClick.current = false;
        setFlyOutDirection(null);
        setIsDragging(false);
    };

    const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
        const currentX = event.touches[0]?.clientX;
        const currentY = event.touches[0]?.clientY;

        if (touchStartX.current === null || touchStartY.current === null || currentX === undefined || currentY === undefined) {
            return;
        }

        const deltaX = currentX - touchStartX.current;
        const deltaY = currentY - touchStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            setIsDragging(true);
            setDragOffsetX(deltaX);
        }
    };

    const resolveSwipe = (startX: number | null, startY: number | null, endX: number, endY: number) => {
        if (startX === null || startY === null) {
            setDragOffsetX(0);
            setIsDragging(false);
            return false;
        }

        const deltaX = startX - endX;
        const deltaY = startY - endY;
        const absoluteX = Math.abs(deltaX);
        const absoluteY = Math.abs(deltaY);

        if (absoluteX < 60 || absoluteX <= absoluteY) {
            resetGesture();
            setDragOffsetX(0);
            return false;
        }

        resetGesture();

        if (deltaX > 40 && onSwipeLeft) {
            animateFlyOut("left");
            return true;
        }

        if (deltaX < -40 && onSwipeRight) {
            animateFlyOut("right");
            return true;
        }

        if (Math.abs(deltaX) > 40 && onNext) {
            setDragOffsetX(0);
            onNext();
            return true;
        }

        setDragOffsetX(0);
        return false;
    };

    const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
        const endX = event.changedTouches[0]?.clientX ?? 0;
        const endY = event.changedTouches[0]?.clientY ?? 0;
        resolveSwipe(touchStartX.current, touchStartY.current, endX, endY);
    };

    const handleTouchCancel = () => {
        resetGesture();
        setDragOffsetX(0);
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse") {
            return;
        }

        pointerStartX.current = event.clientX;
        pointerStartY.current = event.clientY;
        suppressClick.current = false;
        setFlyOutDirection(null);
        setIsDragging(false);
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse" || pointerStartX.current === null || pointerStartY.current === null) {
            return;
        }

        const deltaX = event.clientX - pointerStartX.current;
        const deltaY = event.clientY - pointerStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            setIsDragging(true);
            setDragOffsetX(deltaX);
        }
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse") {
            return;
        }

        resolveSwipe(pointerStartX.current, pointerStartY.current, event.clientX, event.clientY);
    };

    const handlePointerCancel = () => {
        resetGesture();
        setDragOffsetX(0);
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isFlippingDisabled) return;

        const targetElement = event.target as HTMLElement;
        if (targetElement.closest("button, a, input, select, textarea, [data-no-flip='true']")) {
            return;
        }

        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }

        setFlipped((prev) => !prev);
    };

    const absoluteDragX = Math.abs(dragOffsetX);
    const hardOpacity = Math.min(1, Math.max(0, dragOffsetX * -1 / 140));
    const easyOpacity = Math.min(1, Math.max(0, dragOffsetX / 140));
    const cardScale = isDragging ? 0.985 : 1;
    const cardRotate = dragOffsetX / 18;
    const cardShadow = absoluteDragX > 24 ? "0 24px 48px rgba(15, 23, 42, 0.18)" : "0 10px 15px rgba(15, 23, 42, 0.08)";

    const nextCardScale = 0.9 + 0.1 * Math.min(1, absoluteDragX / 140);
    const nextCardOpacity = 0.5 + 0.5 * Math.min(1, absoluteDragX / 140);

    const getBgColor = () => {
        if (dragOffsetX < 0 && hardOpacity > 0) {
            // mix rgb(248, 250, 252) -> rgb(255, 241, 242)
            const r = Math.round(248 + (255 - 248) * hardOpacity);
            const g = Math.round(250 + (241 - 250) * hardOpacity);
            const b = Math.round(252 + (242 - 252) * hardOpacity);
            return `rgb(${r}, ${g}, ${b})`;
        }
        if (dragOffsetX > 0 && easyOpacity > 0) {
            // mix rgb(248, 250, 252) -> rgb(236, 253, 245)
            const r = Math.round(248 + (236 - 248) * easyOpacity);
            const g = Math.round(250 + (253 - 250) * easyOpacity);
            const b = Math.round(252 + (245 - 252) * easyOpacity);
            return `rgb(${r}, ${g}, ${b})`;
        }
        return "rgb(248, 250, 252)";
    };

    const currentBg = getBgColor();
    const springTransition = "transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.2), box-shadow 400ms cubic-bezier(0.175, 0.885, 0.32, 1.2), opacity 400ms ease, background-color 400ms ease";

    return (
        <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Thẻ Từ</p>
                <AudioButton text={item.hanzi} />
            </div>

            <div className="relative mt-4">
                <div
                    className="absolute inset-0 z-0 rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
                    style={{
                        transform: `scale(${nextCardScale}) translateY(${10 - nextCardScale * 10}px)`,
                        opacity: nextCardOpacity,
                        transition: isDragging ? "none" : springTransition,
                    }}
                />

                <div
                    className="pointer-events-none absolute inset-y-0 left-4 z-20 flex items-center"
                    style={{ opacity: hardOpacity }}
                >
                    <div className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                        Hard
                    </div>
                </div>

                <div
                    className="pointer-events-none absolute inset-y-0 right-4 z-20 flex items-center"
                    style={{ opacity: easyOpacity }}
                >
                    <div className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        Easy
                    </div>
                </div>

                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick(e as unknown as MouseEvent<HTMLDivElement>);
                        }
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    className="relative z-10 w-full select-none rounded-2xl border border-primary/5 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
                    style={{
                        perspective: "1000px",
                        touchAction: "pan-y",
                        transform: `translateX(${dragOffsetX}px) rotate(${cardRotate}deg) scale(${cardScale})`,
                        transition: isDragging ? "none" : springTransition,
                        boxShadow: cardShadow,
                        opacity: flyOutDirection ? 0 : 1,
                        backgroundColor: isDragging ? currentBg : "transparent",
                    }}
                >
                    <div
                        className="relative w-full aspect-[3/4] duration-300"
                        style={{
                            transformStyle: "preserve-3d",
                            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                        }}
                    >
                        <div
                            className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-6 bg-white dark:bg-slate-800 ${flipped ? "pointer-events-none" : ""}`}
                            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(1px)" }}
                        >
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-gradient-to-br from-primary to-transparent rounded-2xl"></div>

                            <div className="z-10 flex flex-col items-center justify-center w-full h-full">
                                <span className="text-slate-400 text-sm font-medium mb-4 tracking-widest uppercase">{progress?.status === "learning" ? "Luyện Tập Lại" : "Dịch Ký Tự Này"}</span>
                                <p className="text-8xl lg:text-9xl font-bold text-slate-900 dark:text-white mb-2">{item.hanzi}</p>

                                {item.pinyin && (
                                    <p className="text-2xl font-bold text-slate-500 mt-2 tracking-wide select-none">
                                        {item.pinyin}
                                    </p>
                                )}

                                <div className="absolute bottom-6 left-0 right-0 flex justify-center opacity-40">
                                    <p className="text-xs text-slate-400">Chạm để lật thẻ xem nghĩa</p>
                                </div>
                            </div>
                        </div>

                        <div
                            className={`absolute inset-0 overflow-y-auto rounded-2xl p-6 text-left flex flex-col pt-12 ${!flipped ? "pointer-events-none" : ""}`}
                            style={{
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                                transform: "rotateY(180deg) translateZ(1px)",
                                backgroundColor: isDragging ? "transparent" : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? "#1e293b" : "#ffffff")
                            }}
                        >
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-gradient-to-br from-primary to-transparent rounded-2xl"></div>

                            <div className="z-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 mb-4 border border-primary/10">
                                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Pinyin</p>
                                <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{item.pinyin}</p>
                            </div>

                            <div className="z-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-primary/10 flex-1">
                                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Nghĩa</p>
                                <p className="mt-1 text-xl font-bold text-primary">{item.meaning}</p>


                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Ví Dụ</p>
                                    <div data-no-flip="true" onClick={e => e.stopPropagation()}>
                                        {item.example.trim() ? <AudioButton text={item.example} /> : null}
                                    </div>
                                </div>
                                <p className="mt-1 text-base text-slate-800">{item.example}</p>

                                <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-500">Ví Dụ & Phiên Âm</p>
                                <p className="mt-1 text-base text-slate-800 dark:text-slate-200 font-medium">{item.example}</p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.examplePinyin}</p>
                                <p className="mt-2 text-base text-slate-700 dark:text-slate-300 border-l-2 border-primary pl-3 italic">{item.exampleMeaning}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
