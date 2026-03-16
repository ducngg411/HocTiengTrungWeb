"use client";

import { MouseEvent, PointerEvent, TouchEvent, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type AudioButtonProps = {
    text: string;
    lang?: string;
    minimal?: boolean;
};

export default function AudioButton({ text, lang = "zh-CN", minimal = false }: AudioButtonProps) {
    const { t } = useLanguage();
    const supported = useMemo(
        () => typeof window !== "undefined" && "speechSynthesis" in window,
        []
    );

    const playAudio = (event?: React.SyntheticEvent) => {
        event?.stopPropagation();
        if (!supported || !text.trim()) return;

        // Tắt toàn bộ hàng đợi đọc trước khi nói câu mới
        window.speechSynthesis.cancel();
        
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error("Lỗi phát âm:", error);
        }
    };

    return (
        <button
            type="button"
            onClick={playAudio}
            onTouchEnd={(e) => {
                e.stopPropagation();
                // Safari iOS đôi khi drop token "User Activation" ở phần onClick nếu item nằm trong rotateY 3D.
                // Kích hoạt ngay tại onTouchEnd là giải pháp an toàn nhất.
                playAudio(e);
            }}
            onPointerDown={(e) => e.stopPropagation()} // Chỉ dừng nổi bọt pointer down để thẻ không bị nhận nhầm
            className={minimal 
                ? "inline-flex items-center justify-center rounded-full size-8 bg-primary/10 text-primary transition hover:bg-primary/20 hover:scale-110 active:scale-95 relative z-10"
                : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] relative z-10 shadow-sm"
            }
            style={{ transform: "translateZ(1px)" }} // Sửa lỗi trình duyệt chặn click mặt sau thẻ 3D
            aria-label={`Phát âm cho ${text}`}
            disabled={!supported}
            title={supported ? "Phát âm" : "Trình duyệt không hỗ trợ phát âm"}
            data-no-flip="true"
        >
            <span className={`material-symbols-outlined ${minimal ? 'text-[20px]' : 'text-[20px]'}`}>volume_up</span>
            {!minimal && t("common.listen")}
        </button>
    );
}
