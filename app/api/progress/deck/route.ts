import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";
import { getDifficultyLabel, toDateKey } from "@/services/progress";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const validation = validateUsername(searchParams.get("username"));
        const deckId = (searchParams.get("deckId") ?? "").trim();

        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        if (!deckId) {
            return NextResponse.json({ error: "deckId is required" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const deck = (await Deck.findOne({ _id: deckId, userId: user._id }).lean()) as {
            _id?: string;
            name?: string;
        } | null;

        if (!deck?._id) {
            return NextResponse.json({ error: "Deck not found" }, { status: 404 });
        }

        const totalCards = await Card.countDocuments({ deckId: deck._id });

        const progressRows = (await UserCardProgress.find({ userId: user._id, deckId: deck._id }).lean()) as unknown as Array<{
            cardId: string;
            reviewCount: number;
            lastReviewedAt?: Date | null;
            nextReviewAt?: Date | null;
            easeFactor: number;
            status: "new" | "learning" | "mastered";
            lastResult?: "hard" | "good" | "easy" | null;
        }>;

        const masteredCards = progressRows.filter((row) => row.status === "mastered").length;
        const reviewedCards = progressRows.filter((row) => row.reviewCount > 0).length;
        const learningCards = Math.max(reviewedCards - masteredCards, 0);

        const todayKey = toDateKey(new Date());
        const todayStudied = new Set(
            progressRows
                .filter((row) => row.lastReviewedAt && toDateKey(new Date(row.lastReviewedAt)) === todayKey)
                .map((row) => String(row.cardId))
        ).size;

        const now = new Date();
        const dueCards = progressRows.filter((row) => row.nextReviewAt && new Date(row.nextReviewAt) <= now).length;

        const hardCards = progressRows
            .filter((row) => row.reviewCount > 0)
            .map((row) => ({
                cardId: String(row.cardId),
                reviewCount: row.reviewCount,
                status: row.status,
                easeFactor: row.easeFactor,
                difficulty: getDifficultyLabel(row.easeFactor),
                lastReviewedAt: row.lastReviewedAt ?? null,
                nextReviewAt: row.nextReviewAt ?? null,
            }))
            .sort((a, b) => a.easeFactor - b.easeFactor)
            .slice(0, 10);

        const progressPercent = totalCards > 0 ? Math.round((reviewedCards / totalCards) * 100) : 0;
        const masteredProgressPercent = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

        return NextResponse.json({
            deckId,
            deckName: deck.name ?? "Deck",
            totalCards,
            reviewedCards,
            learningCards,
            masteredCards,
            unseenCards: Math.max(totalCards - reviewedCards, 0),
            remainingCards: Math.max(totalCards - masteredCards, 0),
            todayStudied,
            dueCards,
            progressPercent,
            masteredProgressPercent,
            hardCards,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch deck progress";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
