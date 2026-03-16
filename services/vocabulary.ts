export type Vocab = {
    word: string;
    pinyin: string;
    meaning: string;
    example: string;
    examplePinyin: string;
    exampleMeaning: string;
};

type GoogleSheetsValuesResponse = {
    values?: unknown[][];
    error?: {
        message?: string;
        status?: string;
    };
};

type GoogleSheetsSpreadsheetResponse = {
    sheets?: Array<{
        properties?: {
            title?: string;
        };
    }>;
    error?: {
        message?: string;
        status?: string;
    };
};

const HEADER_ALIASES = {
    word: ["WORD", "TU MOI", "TUMOI"],
    pinyin: ["PINYIN", "PHIEN AM", "PHIENAM"],
    meaning: ["MEANING", "GIAI THICH", "GIAITHICH"],
    example: ["EXAMPLE", "VI DU", "VIDU"],
    examplePinyin: ["EXAMPLE_PINYIN", "VI DU PINYIN", "PHIEN AM"],
    exampleMeaning: ["EXAMPLE_MEANING", "NGHIA"],
} as const;

function normalizeHeader(value: string): string {
    return value
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .toUpperCase();
}

function getGoogleSheetsApiKey(): string {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
        throw new Error("Missing GOOGLE_SHEETS_API_KEY");
    }

    return apiKey;
}

function toStringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function buildValuesEndpoint(spreadsheetId: string, range: string): URL {
    const endpoint = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    );
    endpoint.searchParams.set("key", getGoogleSheetsApiKey());
    return endpoint;
}

function buildSpreadsheetEndpoint(spreadsheetId: string): URL {
    const endpoint = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
    endpoint.searchParams.set("fields", "sheets(properties(title))");
    endpoint.searchParams.set("key", getGoogleSheetsApiKey());
    return endpoint;
}

function handleGoogleSheetsError(
    responseOk: boolean,
    responseStatus: number,
    responseStatusText: string,
    payload: { error?: { message?: string; status?: string } } | null
): void {
    if (responseOk) {
        return;
    }

    const apiMessage = payload?.error?.message ?? `${responseStatus} ${responseStatusText}`;
    const apiStatus = payload?.error?.status;

    if (apiStatus === "FAILED_PRECONDITION" || apiMessage.includes("not supported for this document")) {
        throw new Error(
            "This file is not a native Google Sheet. Open it in Google Sheets and use File > Save as Google Sheets, then use the new spreadsheet ID."
        );
    }

    throw new Error(`Google Sheets API error: ${apiMessage}`);
}

async function fetchSheetValues(spreadsheetId: string, range: string): Promise<unknown[][]> {
    const endpoint = buildValuesEndpoint(spreadsheetId, range);
    const response = await fetch(endpoint.toString(), {
        method: "GET",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as GoogleSheetsValuesResponse | null;
    handleGoogleSheetsError(response.ok, response.status, response.statusText, payload);

    return Array.isArray(payload?.values) ? payload.values : [];
}

function parseRowsToVocabulary(rows: unknown[][]): Vocab[] {
    if (rows.length === 0) {
        return [];
    }

    const firstRow = Array.isArray(rows[0]) ? rows[0] : [];
    const normalizedFirstRow = firstRow.map((cell) => normalizeHeader(toStringValue(cell)));
    const headerIndexMap = buildIndexMap(normalizedFirstRow);

    if (headerIndexMap) {
        return rows
            .slice(1)
            .filter((row): row is unknown[] => Array.isArray(row) && row.length > 0)
            .map((row) => toVocabByIndex(row, headerIndexMap))
            .filter(hasCoreContent);
    }

    // Fallback: treat every row as data in fixed A:G order (A can be STT).
    const firstCell = toStringValue(rows[0]?.[0]);
    const hasSttColumn = /^\d+$/.test(firstCell);
    const fallbackIndexMap = {
        WORD: hasSttColumn ? 1 : 0,
        PINYIN: hasSttColumn ? 2 : 1,
        MEANING: hasSttColumn ? 3 : 2,
        EXAMPLE: hasSttColumn ? 4 : 3,
        EXAMPLE_PINYIN: hasSttColumn ? 5 : 4,
        EXAMPLE_MEANING: hasSttColumn ? 6 : 5,
    };

    return rows
        .filter((row): row is unknown[] => Array.isArray(row) && row.length > 0)
        .map((row) => toVocabByIndex(row, fallbackIndexMap))
        .filter(hasCoreContent);
}

export function extractSpreadsheetId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
        throw new Error("Google Sheet link is required");
    }

    const directIdPattern = /^[a-zA-Z0-9-_]{20,}$/;
    if (directIdPattern.test(trimmed)) {
        return trimmed;
    }

    const matches = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (matches?.[1]) {
        return matches[1];
    }

    throw new Error("Invalid Google Sheet link");
}

export async function listSpreadsheetSheets(spreadsheetId: string): Promise<string[]> {
    const endpoint = buildSpreadsheetEndpoint(spreadsheetId);
    const response = await fetch(endpoint.toString(), {
        method: "GET",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as GoogleSheetsSpreadsheetResponse | null;
    handleGoogleSheetsError(response.ok, response.status, response.statusText, payload);

    return (payload?.sheets ?? [])
        .map((sheet) => toStringValue(sheet.properties?.title))
        .filter((title) => Boolean(title));
}

export async function getVocabularyFromSheet(spreadsheetId: string, sheetName: string): Promise<Vocab[]> {
    const normalizedSheetName = sheetName.trim();

    if (!normalizedSheetName) {
        throw new Error("Missing sheet name");
    }

    const rows = await fetchSheetValues(spreadsheetId, `${normalizedSheetName}!A:G`);
    return parseRowsToVocabulary(rows);
}

function toVocabByIndex(row: unknown[], indexMap: Record<string, number>): Vocab {
    return {
        word: toStringValue(row[indexMap.WORD]),
        pinyin: toStringValue(row[indexMap.PINYIN]),
        meaning: toStringValue(row[indexMap.MEANING]),
        example: toStringValue(row[indexMap.EXAMPLE]),
        examplePinyin: toStringValue(row[indexMap.EXAMPLE_PINYIN]),
        exampleMeaning: toStringValue(row[indexMap.EXAMPLE_MEANING]),
    };
}

function hasCoreContent(item: Vocab): boolean {
    return Boolean(item.word || item.pinyin || item.meaning);
}

function findFirstIndex(headers: string[], aliases: readonly string[]): number {
    return headers.findIndex((header) => aliases.includes(header));
}

function buildIndexMap(headers: string[]): Record<string, number> | null {
    const wordIndex = findFirstIndex(headers, HEADER_ALIASES.word);
    const meaningIndex = findFirstIndex(headers, HEADER_ALIASES.meaning);
    const exampleIndex = findFirstIndex(headers, HEADER_ALIASES.example);
    const exampleMeaningIndex = findFirstIndex(headers, HEADER_ALIASES.exampleMeaning);

    const pinyinAliasSet = new Set<string>(HEADER_ALIASES.pinyin);
    const pinyinIndices = headers
        .map((value, idx) => ({ value, idx }))
        .filter(({ value }) => pinyinAliasSet.has(value))
        .map(({ idx }) => idx);

    const pinyinIndex = pinyinIndices[0] ?? -1;
    const examplePinyinIndex = pinyinIndices[1] ?? pinyinIndices[0] ?? -1;

    const allFound = [wordIndex, pinyinIndex, meaningIndex, exampleIndex, examplePinyinIndex, exampleMeaningIndex].every(
        (index) => index >= 0
    );

    if (!allFound) {
        return null;
    }

    return {
        WORD: wordIndex,
        PINYIN: pinyinIndex,
        MEANING: meaningIndex,
        EXAMPLE: exampleIndex,
        EXAMPLE_PINYIN: examplePinyinIndex,
        EXAMPLE_MEANING: exampleMeaningIndex,
    };
}

export async function getVocabulary(): Promise<Vocab[]> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const range = process.env.GOOGLE_SHEETS_RANGE ?? "Sheet1!A:G";

    if (!spreadsheetId) {
        throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
    }

    const rows = await fetchSheetValues(spreadsheetId, range);
    return parseRowsToVocabulary(rows);
}
