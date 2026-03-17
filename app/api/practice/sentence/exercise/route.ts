import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import Exercise from "@/models/Exercise";
import User from "@/models/User";
import { validateUsername } from "@/services/auth";

type SentenceExercisePayload = {
    username?: unknown;
    deckId?: unknown;
    mode?: unknown;
    cardId?: unknown;
};

type CardLean = {
    _id: string;
    word: string;
    pinyin: string;
    meaning: string;
    example: string;
    exampleMeaning: string;
};

function buildInstruction(mode: "specific" | "random" | "translation", card: CardLean): {
    instruction: string;
    sourceText: string;
    expectedText: string;
} {
    if (mode === "translation") {
        const sourceText = card.exampleMeaning || card.meaning;
        const expectedText = card.example || card.word;
        return {
            instruction: `Translate into Chinese: \"${sourceText}\"`,
            sourceText,
            expectedText,
        };
    }

    return {
        instruction: `Write a natural Chinese sentence using the word \"${card.word}\" (${card.meaning || "no meaning"}).`,
        sourceText: "",
        expectedText: card.example || "",
    };
}

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as SentenceExercisePayload;

        const validation = validateUsername(payload.username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const deckId = typeof payload.deckId === "string" ? payload.deckId.trim() : "";
        const mode = typeof payload.mode === "string" ? payload.mode.trim() : "";
        const cardId = typeof payload.cardId === "string" ? payload.cardId.trim() : "";

        if (!deckId) {
            return NextResponse.json({ error: "deckId is required" }, { status: 400 });
        }

        if (!mode || !["specific", "random", "translation"].includes(mode)) {
            return NextResponse.json({ error: "mode must be specific, random, or translation" }, { status: 400 });
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

        let card: CardLean | null = null;

        if (mode === "specific") {
            if (!cardId) {
                return NextResponse.json({ error: "cardId is required for specific mode" }, { status: 400 });
            }

            card = (await Card.findOne({ _id: cardId, deckId: deck._id }).lean()) as CardLean | null;
        } else if (mode === "translation") {
            if (cardId) {
                card = (await Card.findOne({ _id: cardId, deckId: deck._id }).lean()) as CardLean | null;
            } else {
                const count = await Card.countDocuments({ deckId: deck._id, example: { $ne: "" }, exampleMeaning: { $ne: "" } });
                if (count > 0) {
                    const randomOffset = Math.floor(Math.random() * count);
                    card = (await Card.findOne({ deckId: deck._id, example: { $ne: "" }, exampleMeaning: { $ne: "" } })
                        .skip(randomOffset)
                        .lean()) as CardLean | null;
                }
            }

            if (!card) {
                return NextResponse.json({ error: "No card with translation example found" }, { status: 400 });
            }
        } else {
            const count = await Card.countDocuments({ deckId: deck._id });
            if (count <= 0) {
                return NextResponse.json({ error: "No cards found in this deck" }, { status: 400 });
            }
            const randomOffset = Math.floor(Math.random() * count);
            card = (await Card.findOne({ deckId: deck._id }).skip(randomOffset).lean()) as CardLean | null;
        }

        if (!card) {
            return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        const details = buildInstruction(mode as "specific" | "random" | "translation", card);

        const exercise = await Exercise.create({
            userId: user._id,
            deckId: deck._id,
            cardId: card._id,
            type: "sentence",
            mode,
            instruction: details.instruction,
            sourceText: details.sourceText,
            expectedText: details.expectedText,
            metadata: {
                word: card.word,
                meaning: card.meaning,
                pinyin: card.pinyin,
            },
        });

        return NextResponse.json({
            exerciseId: String(exercise._id),
            cardId: String(card._id),
            mode,
            instruction: details.instruction,
            sourceText: details.sourceText,
            expectedText: details.expectedText,
            word: card.word,
            meaning: card.meaning,
            pinyin: card.pinyin,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate sentence exercise";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
