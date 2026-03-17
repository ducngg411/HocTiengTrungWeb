import { NextResponse } from "next/server";
import { getGeminiKeyStatus, skipCurrentGeminiKey } from "@/services/sentence-grading";

export async function GET() {
    return NextResponse.json({ keys: getGeminiKeyStatus() });
}

export async function POST() {
    const { skipped } = skipCurrentGeminiKey();
    return NextResponse.json({
        skipped,
        keys: getGeminiKeyStatus(),
    });
}
