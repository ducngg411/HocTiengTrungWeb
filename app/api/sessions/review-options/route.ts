import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Deck from "@/models/Deck";
import LearningSession from "@/models/LearningSession";
import ReviewLog from "@/models/ReviewLog";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";

/**
 * Compute timezone-aware day boundaries in UTC.
 *
 * @param tzOffsetMinutes - value from client's `new Date().getTimezoneOffset()`
 *   (negative for UTC+ zones, e.g. Vietnam UTC+7 → -420)
 */
function getDayBoundaries(tzOffsetMinutes: number) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // How many ms to ADD to UTC to get the user's local time
    const localOffsetMs = -tzOffsetMinutes * 60 * 1000;

    // Current UTC time shifted to appear as the user's local time
    const localNow = new Date(Date.now() + localOffsetMs);

    // Midnight of the user's "today" expressed as a UTC date
    const localTodayMidnight = Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate()
    );

    // Convert that local midnight back to real UTC
    const todayStart = new Date(localTodayMidnight - localOffsetMs);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

    return { todayStart, yesterdayStart, tomorrowStart };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username") ?? "";
        const deckId = searchParams.get("deckId") ?? "";
        // Client sends new Date().getTimezoneOffset() — negative for UTC+ zones
        const tzOffsetMinutes = parseInt(searchParams.get("tz") ?? "0", 10);

        const validation = validateUsername(username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const deck = (await Deck.findOne({ _id: deckId, userId: user._id }).lean()) as { _id?: string } | null;
        if (!deck?._id) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

        const { todayStart, yesterdayStart, tomorrowStart } = getDayBoundaries(tzOffsetMinutes);

        // ── Primary: UserCardProgress.firstLearnedAt (set on first ever review) ──
        // Covers both easy and hard actions. Naturally rolls over at midnight.
        type ProgressRow = { cardId: { toString(): string } };
        type LastSessionRow = { reviewedCardIds: { toString(): string }[]; startedAt: Date } | null;

        const [rawToday, rawYesterday, rawLastSession] = await Promise.all([
            UserCardProgress.find({
                userId: user._id,
                deckId: deck._id,
                firstLearnedAt: { $gte: todayStart, $lt: tomorrowStart },
            })
                .select("cardId")
                .lean()
                .exec(),

            UserCardProgress.find({
                userId: user._id,
                deckId: deck._id,
                firstLearnedAt: { $gte: yesterdayStart, $lt: todayStart },
            })
                .select("cardId")
                .lean()
                .exec(),

            // Last session: use reviewedCardIds (actually reviewed), not plannedCardIds
            LearningSession.findOne({ userId: user._id, deckId: deck._id, type: "learn" })
                .sort({ startedAt: -1 })
                .select("reviewedCardIds startedAt")
                .lean()
                .exec(),
        ]);

        const progressToday = rawToday as unknown as ProgressRow[];
        const progressYesterday = rawYesterday as unknown as ProgressRow[];
        const lastLearnSession = rawLastSession as unknown as LastSessionRow;

        const progressTodayIds = progressToday.map((p) => p.cardId.toString());
        const progressYesterdayIds = progressYesterday.map((p) => p.cardId.toString());

        // ── Fallback: ReviewLog aggregate for cards without firstLearnedAt ──
        // Handles data that existed before firstLearnedAt was introduced.
        type AggResult = { _id: { toString(): string }; firstReview: Date };

        const [logTodayAgg, logYesterdayAgg] = await Promise.all([
            ReviewLog.aggregate<AggResult>([
                { $match: { userId: user._id, deckId: deck._id } },
                { $group: { _id: "$cardId", firstReview: { $min: "$reviewedAt" } } },
                { $match: { firstReview: { $gte: todayStart, $lt: tomorrowStart } } },
            ]),
            ReviewLog.aggregate<AggResult>([
                { $match: { userId: user._id, deckId: deck._id } },
                { $group: { _id: "$cardId", firstReview: { $min: "$reviewedAt" } } },
                { $match: { firstReview: { $gte: yesterdayStart, $lt: todayStart } } },
            ]),
        ]);

        const logTodayIds = logTodayAgg.map((r) => r._id.toString());
        const logYesterdayIds = logYesterdayAgg.map((r) => r._id.toString());

        // Union both sources (deduplicated). After midnight the day windows shift
        // automatically, so "today" cards become "yesterday" without any extra logic.
        const todayCardIds = dedupeIds([...progressTodayIds, ...logTodayIds]);
        const yesterdayCardIds = dedupeIds([...progressYesterdayIds, ...logYesterdayIds]);

        // ── Last learn session ───────────────────────────────────────────────
        // Use reviewedCardIds (cards the user actually went through), not plannedCardIds.
        const lastSessionCardIds = lastLearnSession
            ? dedupeIds(lastLearnSession.reviewedCardIds)
            : [];

        // ── All learned cards ─────────────────────────────────────────────────
        const learnedProgress = (await UserCardProgress.find({
            userId: user._id,
            deckId: deck._id,
            reviewCount: { $gt: 0 },
        })
            .select("cardId")
            .lean()
            .exec()) as unknown as { cardId: { toString(): string } }[];

        const allLearnedCardIds = learnedProgress.map((p) => p.cardId.toString());

        return NextResponse.json({
            today: { count: todayCardIds.length, cardIds: todayCardIds },
            yesterday: { count: yesterdayCardIds.length, cardIds: yesterdayCardIds },
            lastSession: {
                count: lastSessionCardIds.length,
                cardIds: lastSessionCardIds,
                startedAt: lastLearnSession?.startedAt ?? null,
            },
            allLearned: { count: allLearnedCardIds.length, cardIds: allLearnedCardIds },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load review options";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function dedupeIds(ids: { toString(): string }[]): string[] {
    return [...new Set(ids.map((id) => id.toString()))];
}
