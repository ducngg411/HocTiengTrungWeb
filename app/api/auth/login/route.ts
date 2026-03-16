import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { validateUsername } from "@/services/auth";

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as { username?: unknown };
        const validation = validateUsername(payload.username);

        if (!validation.valid || !validation.value) {
            return NextResponse.json({ error: validation.message ?? "Invalid username" }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findOne({ username: validation.value });

        if (!user) {
            await User.create({ username: validation.value });
        }

        return NextResponse.json({
            username: validation.value,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
