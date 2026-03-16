import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import ReviewLog from "@/models/ReviewLog";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";
import { formatSecondsToClock, toDateKey } from "@/services/progress";

function computeStreakFromDateKeys(dateKeys: string[]): number {
    if (!dateKeys.length) return 0;

    const set = new Set(dateKeys);
    let streak = 0;
    const cursor = new Date();

    while (set.has(toDateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const validation = validateUsername(searchParams.get("username"));

        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const deckRows = (await Deck.find({ userId: user._id }).sort({ createdAt: -1 }).lean()) as unknown as Array<{
            _id: string;
            name: string;
        }>;

        const progressRows = (await UserCardProgress.find({ userId: user._id }).lean()) as unknown as Array<{
            deckId: string;
            cardId: string;
            reviewCount: number;
            status: "new" | "learning" | "mastered";
            lastReviewedAt?: Date | null;
            totalStudySeconds?: number;
        }>;

        const totalCards = await Card.countDocuments({ deckId: { $in: deckRows.map((deck) => deck._id) } });
        const reviewedCards = progressRows.filter((row) => row.reviewCount > 0).length;
        const masteredCards = progressRows.filter((row) => row.status === "mastered").length;

        const todayKey = toDateKey(new Date());
        const todayStudiedCards = new Set(
            progressRows
                .filter((row) => row.lastReviewedAt && toDateKey(new Date(row.lastReviewedAt)) === todayKey)
                .map((row) => String(row.cardId))
        ).size;

        const reviewDateKeys = (
            (await ReviewLog.find({ userId: user._id }).select({ reviewedAt: 1, _id: 0 }).lean()) as unknown as Array<{
                reviewedAt?: Date;
            }>
        )
            .map((row) => (row.reviewedAt ? toDateKey(new Date(row.reviewedAt)) : ""))
            .filter((key) => Boolean(key));

        const streak = computeStreakFromDateKeys(Array.from(new Set(reviewDateKeys)));

        const totalStudySeconds = progressRows.reduce((sum, row) => sum + (row.totalStudySeconds ?? 0), 0);
        const totalCardsReviewed = progressRows.reduce((sum, row) => sum + Math.max(0, row.reviewCount), 0);

        const deckStats = await Promise.all(
            deckRows.map(async (deck) => {
                const deckTotalCards = await Card.countDocuments({ deckId: deck._id });
                const deckProgressRows = progressRows.filter((row) => String(row.deckId) === String(deck._id));
                const deckReviewedCards = deckProgressRows.filter((row) => row.reviewCount > 0).length;
                const deckMasteredCards = deckProgressRows.filter((row) => row.status === "mastered").length;
                const deckTodayStudied = new Set(
                    deckProgressRows
                        .filter((row) => row.lastReviewedAt && toDateKey(new Date(row.lastReviewedAt)) === todayKey)
                        .map((row) => String(row.cardId))
                ).size;

                return {
                    deckId: String(deck._id),
                    deckName: deck.name,
                    totalCards: deckTotalCards,
                    reviewedCards: deckReviewedCards,
                    masteredCards: deckMasteredCards,
                    progressPercent: deckTotalCards > 0 ? Math.round((deckReviewedCards / deckTotalCards) * 100) : 0,
                    masteredProgressPercent: deckTotalCards > 0 ? Math.round((deckMasteredCards / deckTotalCards) * 100) : 0,
                    todayStudied: deckTodayStudied,
                };
            })
        );

        return NextResponse.json({
            totalDecks: deckRows.length,
            totalCards,
            reviewedCards,
            masteredCards,
            overallProgressPercent: totalCards > 0 ? Math.round((reviewedCards / totalCards) * 100) : 0,
            masteredProgressPercent: totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0,
            todayStudiedCards,
            streak,
            totalStudySeconds,
            totalStudyTimeLabel: formatSecondsToClock(totalStudySeconds),
            totalCardsReviewed,
            deckStats,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch user progress";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
