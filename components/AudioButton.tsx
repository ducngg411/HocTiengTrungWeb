"use client";

import { useMemo } from "react";

type AudioButtonProps = {
    text: string;
    lang?: string;
};

export default function AudioButton({ text, lang = "zh-CN" }: AudioButtonProps) {
    const supported = useMemo(
        () => typeof window !== "undefined" && "speechSynthesis" in window,
        []
    );

    const playAudio = () => {
        if (!supported || !text.trim()) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    return (
        <button
            type="button"
            onClick={playAudio}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            aria-label={`Play pronunciation for ${text}`}
            disabled={!supported}
            title={supported ? "Play pronunciation" : "Speech is not supported in this browser"}
        >
            Listen
        </button>
    );
}
