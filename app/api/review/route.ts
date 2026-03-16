import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import ReviewLog from "@/models/ReviewLog";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";
import { computeUpdatedCardProgress, type CardStatus, type ReviewAction } from "@/services/progress";

type ReviewPayload = {
    username?: unknown;
    deckId?: unknown;
    cardId?: unknown;
    action?: unknown;
    studySeconds?: unknown;
};

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as ReviewPayload;

        const validation = validateUsername(payload.username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const deckId = typeof payload.deckId === "string" ? payload.deckId.trim() : "";
        const cardId = typeof payload.cardId === "string" ? payload.cardId.trim() : "";
        const action = typeof payload.action === "string" ? payload.action.trim() : "";
        const studySeconds = typeof payload.studySeconds === "number" ? payload.studySeconds : 0;

        if (!deckId || !cardId) {
            return NextResponse.json({ error: "deckId and cardId are required" }, { status: 400 });
        }

        if (!["hard", "easy"].includes(action)) {
            return NextResponse.json({ error: "action must be hard or easy" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const deck = (await Deck.findOne({ _id: deckId, userId: user._id }).lean()) as { _id?: string } | null;
        if (!deck?._id) {
            return NextResponse.json({ error: "Deck not found" }, { status: 404 });
        }

        const card = (await Card.findOne({ _id: cardId, deckId: deck._id }).lean()) as { _id?: string } | null;
        if (!card?._id) {
            return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        const currentProgress = (await UserCardProgress.findOne({ userId: user._id, cardId: card._id }).lean()) as {
            reviewCount?: number;
            status?: CardStatus;
            totalStudySeconds?: number;
        } | null;

        const nextProgress = computeUpdatedCardProgress(
            {
                reviewCount: currentProgress?.reviewCount ?? 0,
                status: currentProgress?.status ?? "new",
                totalStudySeconds: currentProgress?.totalStudySeconds ?? 0,
            },
            action as ReviewAction,
            studySeconds,
            new Date()
        );

        await UserCardProgress.findOneAndUpdate(
            { userId: user._id, cardId: card._id },
            {
                $set: {
                    deckId: deck._id,
                    reviewCount: nextProgress.reviewCount,
                    lastReviewedAt: nextProgress.lastReviewedAt,
                    status: nextProgress.status,
                    totalStudySeconds: nextProgress.totalStudySeconds,
                },
            },
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
        });

        return NextResponse.json({
            cardId,
            reviewCount: nextProgress.reviewCount,
            lastReviewedAt: nextProgress.lastReviewedAt,
            status: nextProgress.status,
            totalStudySeconds: nextProgress.totalStudySeconds,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to record review";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
