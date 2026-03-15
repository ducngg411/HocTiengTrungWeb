import { NextResponse } from "next/server";
import { getVocabulary } from "@/services/vocabulary";

export async function GET() {
    try {
        const vocabulary = await getVocabulary();
        return NextResponse.json(vocabulary);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load vocabulary";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
