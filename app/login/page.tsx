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
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Header Icon & Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
                        <span className="material-symbols-outlined text-[40px]">school</span>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Đăng Nhập
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        Bắt đầu hành trình học từ vựng của bạn
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-primary/5">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 pl-1" htmlFor="username-input">
                                Tên người dùng
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                </span>
                                <input
                                    id="username-input"
                                    value={usernameInput}
                                    onChange={(event) => setUsernameInput(event.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleLogin();
                                    }}
                                    placeholder="Ví dụ: ducngg"
                                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 pl-11 pr-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none ring-primary/20 transition-all focus:bg-white dark:focus:bg-slate-800 focus:border-primary focus:ring-4"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogin}
                            disabled={isSubmitting || !usernameInput.trim()}
                            className="w-full relative overflow-hidden rounded-2xl bg-primary px-4 py-4 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:transform-none disabled:opacity-50 disabled:shadow-none group mt-2"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isSubmitting ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                                        Đang đăng nhập...
                                    </>
                                ) : (
                                    <>
                                        Tiếp tục
                                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                                    </>
                                )}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                        </button>

                        {error && (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                                <span className="material-symbols-outlined text-[18px]">error</span>
                                <p className="font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
