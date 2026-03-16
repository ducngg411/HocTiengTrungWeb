export function normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
}

export function validateUsername(rawUsername: unknown): { valid: boolean; value?: string; message?: string } {
    if (typeof rawUsername !== "string") {
        return { valid: false, message: "Username is required" };
    }

    const username = normalizeUsername(rawUsername);

    if (!username) {
        return { valid: false, message: "Username is required" };
    }

    if (username.length < 2 || username.length > 40) {
        return { valid: false, message: "Username must have 2-40 characters" };
    }

    return { valid: true, value: username };
}
