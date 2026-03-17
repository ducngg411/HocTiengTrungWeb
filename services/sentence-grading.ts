type SentenceGradingInput = {
    word: string;
    meaning: string;
    instruction: string;
    studentSentence: string;
    mode: "specific" | "random" | "translation";
    sourceText?: string;
    expectedText?: string;
};

export type SentenceGradingResult = {
    usageScore: number;
    grammarScore: number;
    naturalnessScore: number;
    correctUsage: boolean;
    grammarFeedback: string;
    improvedSentence: string;
    improvedPinyin: string;
    improvedMeaning: string;
    feedback: string;
};

const sentenceGradingCache = new Map<string, SentenceGradingResult>();

function clampScore(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(parsed)) return 0;
    return Math.min(10, Math.max(0, Math.round(parsed * 10) / 10));
}

function extractJsonObject(text: string): string {
    const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const firstBrace = text.indexOf("{");
    if (firstBrace < 0) return text.trim();

    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1);
    }

    // JSON bị truncated — không có closing brace, trả về từ { đến cuối để repairJson xử lý
    return text.slice(firstBrace);
}

/**
 * Cố gắng sửa JSON bị truncated bằng cách đóng các string/object còn đang mở.
 */
function repairJson(raw: string): string {
    let s = raw.trimEnd();

    // Xoá trailing dấu phẩy, dấu hai chấm, khoảng trắng
    s = s.replace(/[,:\s]+$/, "");

    // Đền chuỗi đang mở (số lượng dấu " lẻ)
    const quoteCount = (s.match(/(?<!\\)"/g) ?? []).length;
    if (quoteCount % 2 !== 0) {
        s += '"';
    }

    // Đóng objects còn mở
    const opens = (s.match(/{/g) ?? []).length;
    const closes = (s.match(/}/g) ?? []).length;
    for (let i = 0; i < opens - closes; i++) {
        s += "}";
    }

    return s;
}

function buildPrompt(input: SentenceGradingInput): string {
    return [
        "You are a Chinese language teacher and strict evaluator.",
        "Evaluate the student's Chinese sentence. All text feedback must be written in Vietnamese (Tiếng Việt).",
        "",
        `Mode: ${input.mode}`,
        `Vocabulary word: ${input.word}`,
        `Meaning: ${input.meaning || "N/A"}`,
        `Instruction: ${input.instruction}`,
        `Source text (if translation mode): ${input.sourceText || "N/A"}`,
        `Reference sentence (if available): ${input.expectedText || "N/A"}`,
        "",
        "Student sentence:",
        input.studentSentence,
        "",
        "Tasks:",
        "1. Score vocabulary usage from 0-10.",
        "2. Score grammar correctness from 0-10.",
        "3. Score naturalness from 0-10.",
        "4. Check if word usage is correct as boolean.",
        "5. Give short grammar/naturalness feedback IN VIETNAMESE.",
        "6. Provide one improved sentence in Chinese characters.",
        "7. Provide the pinyin for the improved sentence.",
        "8. Provide the Vietnamese translation of the improved sentence.",
        "9. Give overall feedback IN VIETNAMESE.",
        "",
        "Return strict JSON:",
        "{",
        '  "usage_score": number,',
        '  "grammar_score": number,',
        '  "naturalness_score": number,',
        '  "correct_usage": boolean,',
        '  "grammar_feedback": string (in Vietnamese),',
        '  "improved_sentence": string (Chinese characters only),',
        '  "improved_pinyin": string (pinyin of improved sentence),',
        '  "improved_meaning": string (Vietnamese translation of improved sentence),',
        '  "feedback": string (in Vietnamese)',
        "}",
    ].join("\n");
}

export async function gradeSentenceWithGemini(input: SentenceGradingInput): Promise<SentenceGradingResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const cacheKey = JSON.stringify({
        word: input.word,
        meaning: input.meaning,
        instruction: input.instruction,
        mode: input.mode,
        sourceText: input.sourceText || "",
        expectedText: input.expectedText || "",
        answer: input.studentSentence.trim().toLowerCase(),
    });

    const cached = sentenceGradingCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: buildPrompt(input) }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {
                            usage_score: { type: "number" },
                            grammar_score: { type: "number" },
                            naturalness_score: { type: "number" },
                            correct_usage: { type: "boolean" },
                            grammar_feedback: { type: "string" },
                            improved_sentence: { type: "string" },
                            improved_pinyin: { type: "string" },
                            improved_meaning: { type: "string" },
                            feedback: { type: "string" },
                        },
                        required: ["usage_score", "grammar_score", "naturalness_score", "correct_usage", "grammar_feedback", "improved_sentence", "improved_pinyin", "improved_meaning", "feedback"],
                    },
                },
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Gemini API failed: ${response.status} ${body}`);
        }

        const payload = (await response.json()) as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>;
                };
            }>;
        };

        const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!rawText) {
            throw new Error("Gemini returned empty response");
        }

        console.log("[Gemini] raw response text:", rawText);

        let parsed: {
            usage_score?: unknown;
            grammar_score?: unknown;
            naturalness_score?: unknown;
            correct_usage?: unknown;
            grammar_feedback?: unknown;
            improved_sentence?: unknown;
            improved_pinyin?: unknown;
            improved_meaning?: unknown;
            feedback?: unknown;
        };
        const extracted = extractJsonObject(rawText);
        try {
            parsed = JSON.parse(extracted);
        } catch {
            // Thử repair nếu JSON bị truncated
            const repaired = repairJson(extracted);
            console.warn("[Gemini] JSON truncated, attempting repair. Repaired:\n", repaired);
            try {
                parsed = JSON.parse(repaired);
            } catch (parseErr) {
                console.error("[Gemini] JSON parse failed after repair. Raw text was:\n", rawText);
                throw new Error(`Gemini response JSON parse error: ${(parseErr as Error).message}\nRaw: ${rawText.slice(0, 300)}`);
            }
        }

        const result: SentenceGradingResult = {
            usageScore: clampScore(parsed.usage_score),
            grammarScore: clampScore(parsed.grammar_score),
            naturalnessScore: clampScore(parsed.naturalness_score),
            correctUsage: Boolean(parsed.correct_usage),
            grammarFeedback: typeof parsed.grammar_feedback === "string" ? parsed.grammar_feedback : "",
            improvedSentence: typeof parsed.improved_sentence === "string" ? parsed.improved_sentence : "",
            improvedPinyin: typeof parsed.improved_pinyin === "string" ? parsed.improved_pinyin : "",
            improvedMeaning: typeof parsed.improved_meaning === "string" ? parsed.improved_meaning : "",
            feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
        };

        sentenceGradingCache.set(cacheKey, result);
        return result;
    } finally {
        clearTimeout(timeout);
    }
}
