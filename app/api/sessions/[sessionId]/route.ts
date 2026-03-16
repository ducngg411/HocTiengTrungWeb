import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import LearningSession from "@/models/LearningSession";
import User from "@/models/User";
import { validateUsername } from "@/services/auth";

type EndSessionPayload = {
    username?: unknown;
};

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const payload = (await request.json().catch(() => ({}))) as EndSessionPayload;

        const validation = validateUsername(payload.username);
        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }

        await connectToDatabase();

        const user = (await User.findOne({ username: validation.value }).lean()) as { _id?: string } | null;
        if (!user?._id) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const session = await LearningSession.findOneAndUpdate(
            { _id: sessionId, userId: user._id, endedAt: null },
            { $set: { endedAt: new Date() } },
            { new: true }
        );

        if (!session) {
            return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to end session";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
