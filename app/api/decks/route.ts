import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/models/Card";
import Deck from "@/models/Deck";
import User from "@/models/User";
import { validateUsername } from "@/services/auth";
import { extractSpreadsheetId, getVocabularyFromSheet, listSpreadsheetSheets } from "@/services/vocabulary";

type CreateDeckPayload = {
    username?: unknown;
    name?: unknown;
    description?: unknown;
    sheetUrl?: unknown;
    sheetName?: unknown;
};

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
            return NextResponse.json([]);
        }

        const decks = (await Deck.find({ userId: user._id }).sort({ createdAt: -1 }).lean()) as unknown as Array<{
            _id: string;
            name: string;
            description: string;
            sheetName: string;
            createdAt: string;
        }>;
        const decksWithCount = await Promise.all(
            decks.map(async (deck) => ({
                id: String(deck._id),
                name: deck.name,
                description: deck.description,
                sheetName: deck.sheetName,
                createdAt: deck.createdAt,
                cardCount: await Card.countDocuments({ deckId: deck._id }),
            }))
        );

        return NextResponse.json(decksWithCount);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch decks";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as CreateDeckPayload;
        const validation = validateUsername(payload.username);

        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        const name = typeof payload.name === "string" ? payload.name.trim() : "";
        const description = typeof payload.description === "string" ? payload.description.trim() : "";
        const sheetUrl = typeof payload.sheetUrl === "string" ? payload.sheetUrl.trim() : "";
        const sheetName = typeof payload.sheetName === "string" ? payload.sheetName.trim() : "";

        if (!name) {
            return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
        }

        if (!sheetUrl) {
            return NextResponse.json({ error: "Google Sheet link is required" }, { status: 400 });
        }

        if (!sheetName) {
            return NextResponse.json({ error: "Please choose a sheet tab" }, { status: 400 });
        }

        const spreadsheetId = extractSpreadsheetId(sheetUrl);
        const availableSheets = await listSpreadsheetSheets(spreadsheetId);

        if (!availableSheets.includes(sheetName)) {
            return NextResponse.json({ error: "Selected sheet tab was not found" }, { status: 400 });
        }

        const vocabulary = await getVocabularyFromSheet(spreadsheetId, sheetName);

        if (!vocabulary.length) {
            return NextResponse.json({ error: "No vocabulary rows were found in the selected sheet tab" }, { status: 400 });
        }

        await connectToDatabase();

        let user = (await User.findOne({ username: validation.value })) as { _id: string } | null;

        if (!user) {
            user = (await User.create({ username: validation.value })) as { _id: string };
        }

        const deck = await Deck.create({
            userId: user._id,
            name,
            description,
            spreadsheetId,
            sheetName,
        });

        await Card.insertMany(
            vocabulary.map((item, position) => ({
                deckId: deck._id,
                position,
                word: item.word,
                pinyin: item.pinyin,
                meaning: item.meaning,
                example: item.example,
                examplePinyin: item.examplePinyin,
                exampleMeaning: item.exampleMeaning,
            }))
        );

        return NextResponse.json(
            {
                id: String(deck._id),
                name: deck.name,
                description: deck.description,
                sheetName: deck.sheetName,
                createdAt: deck.createdAt,
                cardCount: vocabulary.length,
            },
            { status: 201 }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create deck";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
