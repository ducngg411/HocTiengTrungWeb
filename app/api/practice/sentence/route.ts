import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import Exercise from "@/models/Exercise";
import PracticeAttempt from "@/models/PracticeAttempt";
import ReviewLog from "@/models/ReviewLog";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";
import { computeUpdatedCardProgress, type CardStatus, type ReviewAction } from "@/services/progress";
import { gradeSentenceWithGemini } from "@/services/sentence-grading";

type SubmitSentencePayload = {
    username?: unknown;
    exerciseId?: unknown;
    answer?: unknown;
    studySeconds?: unknown;
};

type ExerciseLean = {
    _id: string;
    userId: string;
    deckId: string;
    cardId: string;
    mode: "specific" | "random" | "translation";
    instruction: string;
    sourceText?: string;
    expectedText?: string;
};

type CardLean = {
    _id: string;
    word: string;
    meaning: string;
};

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as SubmitSentencePayload;

        const validation = validateUsername(payload.username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const exerciseId = typeof payload.exerciseId === "string" ? payload.exerciseId.trim() : "";
        const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
        const studySeconds = typeof payload.studySeconds === "number" ? payload.studySeconds : 0;

        if (!exerciseId) {
            return NextResponse.json({ error: "exerciseId is required" }, { status: 400 });
        }

        if (!answer) {
            return NextResponse.json({ error: "answer is required" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const exercise = (await Exercise.findOne({ _id: exerciseId, userId: user._id }).lean()) as ExerciseLean | null;
        if (!exercise?._id) {
            return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
        }

        const deck = (await Deck.findOne({ _id: exercise.deckId, userId: user._id }).lean()) as { _id?: string } | null;
        if (!deck?._id) {
            return NextResponse.json({ error: "Deck not found" }, { status: 404 });
        }

        const card = (await Card.findOne({ _id: exercise.cardId, deckId: deck._id }).lean()) as CardLean | null;
        if (!card?._id) {
            return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        const aiResult = await gradeSentenceWithGemini({
            mode: exercise.mode,
            instruction: exercise.instruction,
            word: card.word,
            meaning: card.meaning,
            studentSentence: answer,
            sourceText: exercise.sourceText || "",
            expectedText: exercise.expectedText || "",
        });

        const finalScore = Math.round(((aiResult.usageScore + aiResult.grammarScore + aiResult.naturalnessScore) / 3) * 10) / 10;

        await PracticeAttempt.create({
            userId: user._id,
            deckId: deck._id,
            cardId: card._id,
            exerciseId: exercise._id,
            answer,
            aiScore: finalScore,
            usageScore: aiResult.usageScore,
            grammarScore: aiResult.grammarScore,
            naturalnessScore: aiResult.naturalnessScore,
            correctUsage: aiResult.correctUsage,
            aiFeedback: aiResult.grammarFeedback || aiResult.feedback,
            improvedSentence: aiResult.improvedSentence,
        });

        const currentProgress = (await UserCardProgress.findOne({ userId: user._id, cardId: card._id }).lean()) as {
            reviewCount?: number;
            status?: CardStatus;
            totalStudySeconds?: number;
            firstLearnedAt?: Date | null;
        } | null;

        const action: ReviewAction = finalScore >= 7 ? "easy" : "hard";
        const isFirstReview = !currentProgress || (currentProgress.reviewCount ?? 0) === 0;

        const nextProgress = computeUpdatedCardProgress(
            {
                reviewCount: currentProgress?.reviewCount ?? 0,
                status: currentProgress?.status ?? "new",
                totalStudySeconds: currentProgress?.totalStudySeconds ?? 0,
            },
            action,
            studySeconds,
            new Date()
        );

        const progressUpdate: Record<string, unknown> = {
            deckId: deck._id,
            reviewCount: nextProgress.reviewCount,
            lastReviewedAt: nextProgress.lastReviewedAt,
            status: nextProgress.status,
            totalStudySeconds: nextProgress.totalStudySeconds,
        };

        if (isFirstReview) {
            progressUpdate.firstLearnedAt = nextProgress.lastReviewedAt;
        }

        await UserCardProgress.findOneAndUpdate(
            { userId: user._id, cardId: card._id },
            { $set: progressUpdate },
            { upsert: true, new: true }
        );

        await ReviewLog.create({
            userId: user._id,
            deckId: deck._id,
            cardId: card._id,
            action,
            studySeconds: Math.max(0, Math.round(studySeconds)),
            reviewedAt: nextProgress.lastReviewedAt,
            statusAfter: nextProgress.status,
            sessionId: null,
        });

        return NextResponse.json({
            score: finalScore,
            usageScore: aiResult.usageScore,
            grammarScore: aiResult.grammarScore,
            naturalnessScore: aiResult.naturalnessScore,
            correctUsage: aiResult.correctUsage,
            feedback: aiResult.grammarFeedback || aiResult.feedback,
            improvedSentence: aiResult.improvedSentence,
            improvedPinyin: aiResult.improvedPinyin,
            improvedMeaning: aiResult.improvedMeaning,
            progress: {
                cardId: String(card._id),
                reviewCount: nextProgress.reviewCount,
                status: nextProgress.status,
                lastReviewedAt: nextProgress.lastReviewedAt,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit sentence practice";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
