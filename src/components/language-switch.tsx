"use client";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { useLocale } from "@/i18n/client";

const LABELS = { it: "Italiano", en: "English" } as const;

/** Selettore della lingua nel footer. */
export function LanguageSwitch({ label }: { label: string }) {
  const current = useLocale();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {(["it", "en"] as const).map((l) => (
        <button key={l} type="button" lang={l} disabled={pending || l === current} aria-pressed={l === current}
          onClick={() => start(() => setLocale(l))}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${l === current ? "bg-ink text-white dark:bg-white dark:text-ink" : "border border-line hover:border-brand hover:text-brand"} disabled:cursor-default`}>
          {LABELS[l]}
        </button>))}
    </div>
  );
}
