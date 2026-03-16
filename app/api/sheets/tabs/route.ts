import { NextResponse } from "next/server";
import { extractSpreadsheetId, listSpreadsheetSheets } from "@/services/vocabulary";

export async function POST(request: Request) {
    try {
        const payload = (await request.json().catch(() => ({}))) as { sheetUrl?: unknown };

        if (typeof payload.sheetUrl !== "string" || !payload.sheetUrl.trim()) {
            return NextResponse.json({ error: "sheetUrl is required" }, { status: 400 });
        }

        const spreadsheetId = extractSpreadsheetId(payload.sheetUrl);
        const sheets = await listSpreadsheetSheets(spreadsheetId);

        if (!sheets.length) {
            return NextResponse.json({ error: "No sheets found in this spreadsheet" }, { status: 400 });
        }

        return NextResponse.json({ spreadsheetId, sheets });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read spreadsheet tabs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
