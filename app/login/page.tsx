"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUsername, setStoredUsername } from "@/lib/client-auth";

export default function LoginPage() {
    const router = useRouter();
    const [usernameInput, setUsernameInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const saved = getStoredUsername();
        if (saved) {
            router.replace("/flashcard");
        }
    }, [router]);

    const handleLogin = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username: usernameInput }),
            });

            const payload = (await response.json()) as { username?: string; error?: string };
            if (!response.ok || !payload.username) {
                throw new Error(payload.error || "Đăng nhập thất bại");
            }

            setStoredUsername(payload.username);
            router.replace("/flashcard");
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Đăng nhập thất bại";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:px-6">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900">Đăng Nhập</h1>
                <p className="mt-1 text-sm text-slate-600">Nhập tên người dùng để vào bộ flashcard của bạn.</p>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <label className="text-sm font-medium text-slate-700" htmlFor="username-input">
                    Tên người dùng
                </label>
                <input
                    id="username-input"
                    value={usernameInput}
                    onChange={(event) => setUsernameInput(event.target.value)}
                    placeholder="e.g. ducngg"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-teal-500 transition focus:ring"
                />

                <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isSubmitting}
                    className="mt-4 w-full rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                    {isSubmitting ? "Đang đăng nhập..." : "Tiếp tục"}
                </button>

                {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
            </section>
        </main>
    );
}
