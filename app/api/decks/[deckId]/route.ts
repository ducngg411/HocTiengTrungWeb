import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import ReviewLog from "@/models/ReviewLog";
import User from "@/models/User";
import UserCardProgress from "@/models/UserCardProgress";
import { validateUsername } from "@/services/auth";

type RouteContext = {
    params: Promise<{ deckId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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

        const deck = (await Deck.findOne({ _id: deckId, userId: user._id }).lean()) as {
            _id?: string;
            name?: string;
        } | null;

        if (!deck?._id) {
            return NextResponse.json({ error: "Deck not found" }, { status: 404 });
        }

        const deckObjectId = deck._id;

        await Promise.all([
            Deck.deleteOne({ _id: deckObjectId, userId: user._id }),
            Card.deleteMany({ deckId: deckObjectId }),
            UserCardProgress.deleteMany({ userId: user._id, deckId: deckObjectId }),
            ReviewLog.deleteMany({ userId: user._id, deckId: deckObjectId }),
        ]);

        return NextResponse.json({
            message: "Deck deleted successfully",
            deckId,
            deckName: deck.name ?? "Deck",
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete deck";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
