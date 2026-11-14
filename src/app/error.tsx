"use client";
import { useTr } from "@/i18n/client";
import { publicErrorText } from "@/i18n/dict/public-home";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTr(publicErrorText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">{t.errorTitle}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t.errorBody}</p>
      <button onClick={reset} className="mt-4 rounded border px-4 py-2">{t.retry}</button>
    </main>
  );
}
