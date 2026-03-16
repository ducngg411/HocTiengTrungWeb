"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type HanziWriter from "hanzi-writer";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type HanziWritingPracticeProps = {
    hanzi: string;
};

type WritingMode = "blank" | "guided";

export default function HanziWritingPractice({ hanzi }: HanziWritingPracticeProps) {
    const [mode, setMode] = useState<WritingMode>("guided");
    const [quizComplete, setQuizComplete] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const { t } = useLanguage();

    // Guided mode refs
    const guidedContainerRef = useRef<HTMLDivElement | null>(null);
    const writerRef = useRef<InstanceType<typeof HanziWriter> | null>(null);

    // Blank mode canvas refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // Answer animation ref (blank mode)
    const answerContainerRef = useRef<HTMLDivElement | null>(null);
    const answerWriterRef = useRef<InstanceType<typeof HanziWriter> | null>(null);

    // hanzi-writer chỉ hỗ trợ 1 ký tự — tách chuỗi thành từng chữ để luyện riêng
    const chars = Array.from(hanzi.trim()).filter((c) => c.trim() !== "");
    const [charIndex, setCharIndex] = useState(0);
    const char = chars[charIndex] ?? "";

    // ── Guided mode: Hanzi Writer quiz ──────────────────────────────────────
    useEffect(() => {
        if (mode !== "guided" || !char) return;

        let isCancelled = false;

        const load = async () => {
            try {
                const mod = await import("hanzi-writer");
                if (!guidedContainerRef.current || isCancelled) return;

                // Clear any previous SVG injected by hanzi-writer
                guidedContainerRef.current.innerHTML = "";
                writerRef.current = null;
                setQuizComplete(false);

                const writer = mod.default.create(guidedContainerRef.current, char, {
                    width: 260,
                    height: 260,
                    padding: 12,
                    // showOutline = true: hiện nét mờ bao quanh từng nét để user viết theo
                    showOutline: true,
                    // showCharacter = false: không fill sẵn chữ, để người dùng tự vẽ
                    showCharacter: false,
                    outlineColor: "#94a3b8",
                    strokeColor: "#0f172a",
                    radicalColor: "#0ea5e9",
                    drawingColor: "#0ea5e9",
                    highlightColor: "#22c55e",
                    // Sau 2 lần vẽ sai mới hiện gợi ý nét
                    showHintAfterMisses: 2,
                    strokeFadeDuration: 300,
                    delayBetweenStrokes: 200,
                });

                writerRef.current = writer;

                writer.quiz({
                    onComplete: () => setQuizComplete(true),
                });
            } catch (err) {
                console.error("HanziWriter guided init failed", err);
            }
        };

        void load();

        return () => {
            isCancelled = true;
            writerRef.current = null;
        };
    }, [char, mode]);

    // ── Blank mode: Canvas API (nét không biến mất) ─────────────────────────
    const getPos = useCallback((canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }, []);

    const startDraw = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        isDrawingRef.current = true;
        const pos = getPos(canvas, clientX, clientY);
        lastPosRef.current = pos;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#0ea5e9";
        ctx.fill();
    }, [getPos]);

    const continueDraw = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !isDrawingRef.current || !lastPosRef.current) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const pos = getPos(canvas, clientX, clientY);
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        lastPosRef.current = pos;
    }, [getPos]);

    const endDraw = useCallback(() => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        setShowAnswer(false);
        if (answerContainerRef.current) answerContainerRef.current.innerHTML = "";
        answerWriterRef.current = null;
    }, []);

    const handleShowAnswer = useCallback(async () => {
        if (!char) return;
        setShowAnswer(true);

        // Wait for DOM to render the answer container
        await new Promise<void>((r) => setTimeout(r, 60));

        if (!answerContainerRef.current) return;
        answerContainerRef.current.innerHTML = "";

        try {
            const mod = await import("hanzi-writer");
            const writer = mod.default.create(answerContainerRef.current, char, {
                width: 200,
                height: 200,
                padding: 8,
                showOutline: true,
                showCharacter: false,
                strokeColor: "#0f172a",
                radicalColor: "#0ea5e9",
                strokeAnimationSpeed: 0.7,
                delayBetweenStrokes: 500,
            });
            answerWriterRef.current = writer;
            writer.animateCharacter();
        } catch (err) {
            console.error("HanziWriter answer animation failed", err);
        }
    }, [char]);

    const resetBoard = useCallback(() => {
        setQuizComplete(false);
        setShowAnswer(false);
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            if (answerContainerRef.current) answerContainerRef.current.innerHTML = "";
            answerWriterRef.current = null;
        }, 0);
    }, []);

    const switchMode = useCallback((next: WritingMode) => {
        setMode(next);
        resetBoard();
    }, [resetBoard]);

    const switchChar = useCallback((idx: number) => {
        setCharIndex(idx);
        resetBoard();
    }, [resetBoard]);

    const description =
        mode === "blank"
            ? t("practice.writing.descBlank")
            : t("practice.writing.descGuided");

    return (
        <div className="flex flex-col gap-4">
            {/* Mode toggle */}
            <div className="inline-flex items-center rounded-full bg-slate-100/70 dark:bg-slate-800/70 p-1 text-xs font-medium">
                <button
                    type="button"
                    className={`flex-1 px-3 py-1.5 rounded-full transition-all ${mode === "blank" ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-500 dark:text-slate-300"}`}
                    onClick={() => switchMode("blank")}
                >
                    {t("practice.writing.boardBlank")}
                </button>
                <button
                    type="button"
                    className={`flex-1 px-3 py-1.5 rounded-full transition-all ${mode === "guided" ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-500 dark:text-slate-300"}`}
                    onClick={() => switchMode("guided")}
                >
                    {t("practice.writing.boardGuided")}
                </button>
            </div>

            {/* Chọn ký tự khi từ có nhiều hơn 1 chữ */}
            {chars.length > 1 && (
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 shrink-0">{t("practice.writing.charLabel")}</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {chars.map((c, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => switchChar(idx)}
                                className={`w-10 h-10 rounded-xl text-xl font-bold border transition-all ${
                                    charIndex === idx
                                        ? "bg-primary text-white border-primary shadow-sm"
                                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/50"
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-[11px] text-slate-500">{description}</p>

            <div className="flex items-stretch gap-4 flex-col sm:flex-row">
                {/* Left: reference */}
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 px-3 py-4 min-h-[120px]">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                        {chars.length > 1 ? t("practice.writing.charCount", { current: charIndex + 1, total: chars.length }) : t("practice.writing.wordToFill")}
                    </p>
                    <p className="text-6xl sm:text-7xl font-bold text-slate-900 dark:text-white leading-tight">
                        {chars.length > 1 ? char : hanzi}
                    </p>
                    {chars.length > 1 && (
                        <p className="mt-2 text-sm text-slate-400">{hanzi}</p>
                    )}
                </div>

                {/* Right: writing board */}
                <div className="flex-1 flex flex-col gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("practice.writing.boardArea")}</p>

                    {/* ── Guided mode ── */}
                    {mode === "guided" && (
                        <>
                            <div className="rounded-xl bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden" style={{ height: 260 }}>
                                <div
                                    ref={guidedContainerRef}
                                    className="w-[260px] h-[260px]"
                                    data-no-flip="true"
                                />
                            </div>
                            {quizComplete ? (
                                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 px-3 py-2">
                                    <span className="material-symbols-outlined text-base text-emerald-500">check_circle</span>
                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("practice.writing.guidedSuccess")}</p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500">
                                    {t("practice.writing.guidedTut")}
                                </p>
                            )}
                        </>
                    )}

                    {/* ── Blank mode ── */}
                    {mode === "blank" && (
                        <>
                            {/* Canvas + answer overlay trong cùng 1 khung cố định */}
                            <div
                                className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden relative bg-white dark:bg-slate-800"
                                style={{ height: 260 }}
                            >
                                {/* Canvas vẽ tự do */}
                                <canvas
                                    ref={canvasRef}
                                    width={260}
                                    height={260}
                                    className={`absolute inset-0 w-full h-full touch-none cursor-crosshair transition-opacity duration-200 ${showAnswer ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                                    data-no-flip="true"
                                    onPointerDown={(e) => {
                                        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                                        startDraw(e.clientX, e.clientY);
                                    }}
                                    onPointerMove={(e) => continueDraw(e.clientX, e.clientY)}
                                    onPointerUp={endDraw}
                                    onPointerLeave={endDraw}
                                    onPointerCancel={endDraw}
                                />

                                {/* Overlay thứ tự nét — hiện đúng trong khung, không đẩy layout */}
                                <div
                                    className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 ${showAnswer ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                                >
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("practice.writing.standardOrder")}</p>
                                    <div ref={answerContainerRef} className="w-[220px] h-[220px]" data-no-flip="true" />
                                </div>
                            </div>

                            {/* Nút hành động — không thay đổi vị trí dù showAnswer hay không */}
                            <div className="flex gap-2">
                                {showAnswer ? (
                                    <button
                                        type="button"
                                        onClick={() => { setShowAnswer(false); }}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                        {t("practice.writing.rewriteBtn")}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={clearCanvas}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                        {t("practice.writing.clearBtn")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void handleShowAnswer()}
                                    disabled={showAnswer}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-sm">play_circle</span>
                                    {t("practice.writing.showOrderBtn")}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
