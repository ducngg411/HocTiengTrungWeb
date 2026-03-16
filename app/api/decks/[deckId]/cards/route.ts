import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";

type RouteContext = {
    params: Promise<{ deckId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
    try {
        const { searchParams } = new URL(request.url);
        const validation = validateUsername(searchParams.get("username"));

        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const { deckId } = await context.params;

        if (!deckId) {
            return NextResponse.json({ error: "Missing deckId" }, { status: 400 });
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

        const cards = (await Card.find({ deckId: deck._id }).sort({ position: 1 }).lean()) as unknown as Array<{
            _id: string;
            word: string;
            pinyin: string;
            meaning: string;
            example: string;
            examplePinyin: string;
            exampleMeaning: string;
        }>;

        const progressRows = (await UserCardProgress.find({ userId: user._id, deckId: deck._id }).lean()) as unknown as Array<{
            cardId: string;
            reviewCount: number;
            lastReviewedAt?: Date | null;
            status: "new" | "learning" | "mastered";
            totalStudySeconds?: number;
        }>;

        const progressByCardId = new Map(
            progressRows.map((row) => [String(row.cardId), row])
        );

        return NextResponse.json(
            cards.map((card) => ({
                id: String(card._id),
                word: card.word,
                pinyin: card.pinyin,
                meaning: card.meaning,
                example: card.example,
                examplePinyin: card.examplePinyin,
                exampleMeaning: card.exampleMeaning,
                progress: (() => {
                    const progress = progressByCardId.get(String(card._id));

                    if (!progress) {
                        return {
                            reviewCount: 0,
                            lastReviewedAt: null,
                            status: "new",
                            totalStudySeconds: 0,
                        };
                    }

                    return {
                        reviewCount: progress.reviewCount,
                        lastReviewedAt: progress.lastReviewedAt ?? null,
                        status: progress.status,
                        totalStudySeconds: progress.totalStudySeconds ?? 0,
                    };
                })(),
            }))
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch deck cards";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
