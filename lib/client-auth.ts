export const USERNAME_STORAGE_KEY = "htt_username";

export function getStoredUsername(): string {
    if (typeof window === "undefined") {
        return "";
    }

    return localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
}

export function setStoredUsername(username: string): void {
    if (typeof window === "undefined") {
        return;
    }

    localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export function clearStoredUsername(): void {
    if (typeof window === "undefined") {
        return;
    }

    localStorage.removeItem(USERNAME_STORAGE_KEY);
}
