import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Deck from "@/models/Deck";
import LearningSession from "@/models/LearningSession";
import User from "@/models/User";
import { validateUsername } from "@/services/auth";

type SessionPayload = {
    username?: unknown;
    deckId?: unknown;
    type?: unknown;
    scope?: unknown;
    cardIds?: unknown;
};

const VALID_TYPES = ["learn", "review"] as const;
const VALID_SCOPES = ["learn", "today", "yesterday", "last-session", "all-learned"] as const;

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as SessionPayload;

        const validation = validateUsername(payload.username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const deckId = typeof payload.deckId === "string" ? payload.deckId.trim() : "";
        const type = typeof payload.type === "string" ? payload.type.trim() : "";
        const scope = typeof payload.scope === "string" ? payload.scope.trim() : "";
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.filter((id) => typeof id === "string") : [];

        if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });
        if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
            return NextResponse.json({ error: "type must be learn or review" }, { status: 400 });
        }
        if (!VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number])) {
            return NextResponse.json({ error: "scope is invalid" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const deck = (await Deck.findOne({ _id: deckId, userId: user._id }).lean()) as { _id?: string } | null;
        if (!deck?._id) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

        const session = await LearningSession.create({
            userId: user._id,
            deckId: deck._id,
            type,
            scope,
            plannedCardIds: cardIds,
            reviewedCardIds: [],
            startedAt: new Date(),
            endedAt: null,
        });

        return NextResponse.json({ sessionId: session._id.toString() });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create session";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
