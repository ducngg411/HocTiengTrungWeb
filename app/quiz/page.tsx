"use client";

import { useMemo, useState } from "react";
import QuizCard, { QuizQuestion } from "@/components/QuizCard";

const questions: QuizQuestion[] = [
    {
        hanzi: "老师",
        pinyin: "lao shi",
        options: ["student", "teacher", "school", "book"],
        answer: "teacher",
    },
    {
        hanzi: "苹果",
        pinyin: "ping guo",
        options: ["banana", "orange", "apple", "grape"],
        answer: "apple",
    },
    {
        hanzi: "今天",
        pinyin: "jin tian",
        options: ["today", "tomorrow", "yesterday", "night"],
        answer: "today",
    },
];

export default function QuizPage() {
    const [index, setIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);

    const current = questions[index];
    const finished = useMemo(() => index >= questions.length, [index]);

    const submit = () => {
        if (!selectedAnswer) return;

        if (selectedAnswer === current.answer) {
            setScore((prev) => prev + 1);
        }

        setShowResult(true);
    };

    const next = () => {
        if (index === questions.length - 1) {
            setIndex(questions.length);
            return;
        }

        setIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setShowResult(false);
    };

    const restart = () => {
        setIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setScore(0);
    };

    return (
        <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900">Trắc Nghiệm Tiếng Trung</h1>
                <p className="mt-1 text-sm text-slate-600">Chọn đáp án nghĩa tiếng Anh đúng cho mỗi từ tiếng Trung.</p>
            </header>

            {finished ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900">Hoàn Thành</h2>
                    <p className="mt-2 text-base text-slate-700">
                        Điểm: {score} / {questions.length}
                    </p>
                    <button
                        type="button"
                        onClick={restart}
                        className="mt-5 rounded-xl border border-teal-600 bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                        Làm Lại
                    </button>
                </section>
            ) : (
                <>
                    <QuizCard
                        question={current}
                        selectedAnswer={selectedAnswer}
                        onSelect={setSelectedAnswer}
                        showResult={showResult}
                    />

                    <div className="mt-4 flex gap-3">
                        {!showResult ? (
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!selectedAnswer}
                                className="w-full rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Kiểm Tra Đáp Án
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={next}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                {index === questions.length - 1 ? "Xem Điểm" : "Câu Tiếp Theo"}
                            </button>
                        )}
                    </div>

                    <p className="mt-3 text-center text-sm text-slate-500">
                        Câu {index + 1} / {questions.length}
                    </p>
                </>
            )}
        </main>
    );
}
