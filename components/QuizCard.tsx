"use client";

import AudioButton from "@/components/AudioButton";

export type QuizQuestion = {
    hanzi: string;
    pinyin: string;
    options: string[];
    answer: string;
};

type QuizCardProps = {
    question: QuizQuestion;
    selectedAnswer: string | null;
    onSelect: (option: string) => void;
    showResult: boolean;
};

export default function QuizCard({
    question,
    selectedAnswer,
    onSelect,
    showResult,
}: QuizCardProps) {
    return (
        <article className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">Trắc Nghiệm</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900">{question.hanzi}</p>
                    <p className="text-base text-slate-600">{question.pinyin}</p>
                </div>
                <AudioButton text={question.hanzi} />
            </div>

            <div className="mt-5 space-y-3">
                {question.options.map((option) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === question.answer;

                    let style = "border-slate-200 bg-white text-slate-800";
                    if (showResult && isCorrect) {
                        style = "border-teal-400 bg-teal-50 text-teal-800";
                    } else if (showResult && isSelected && !isCorrect) {
                        style = "border-rose-400 bg-rose-50 text-rose-800";
                    } else if (!showResult && isSelected) {
                        style = "border-sky-400 bg-sky-50 text-sky-800";
                    }

                    return (
                        <button
                            key={option}
                            type="button"
                            disabled={showResult}
                            onClick={() => onSelect(option)}
                            className={`w-full rounded-xl border px-4 py-3 text-left text-base font-medium transition ${style}`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </article>
    );
}
