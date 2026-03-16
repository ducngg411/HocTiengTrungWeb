import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-10 sm:px-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Hoc Tieng Trung</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Luyện Từ Vựng Tiếng Trung</h1>
        <p className="mt-3 text-base text-slate-600">
          Chọn một chế độ bên dưới và học một ít từ mới mỗi ngày.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/login"
            className="rounded-xl border border-teal-600 bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Đăng Nhập Flashcard
          </Link>
          <Link
            href="/quiz"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Làm Trắc Nghiệm
          </Link>
        </div>
      </section>
    </main>
  );
}
