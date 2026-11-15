"use client";
import { useState, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/locale";

const LABELS = { it: "Italiano", en: "English" } as const;

/** Selettore della lingua nel footer. La scelta si vede subito (pulsante e barra in cima) mentre la pagina si ricarica. */
export function LanguageSwitch({ label, onDark = false }: { label: string; onDark?: boolean }) {
  const current = useLocale();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Locale | null>(null);
  const active = pending && chosen ? chosen : current;
  return (
    <>
      {pending && <div className="top-progress" role="progressbar" aria-label={label} />}
      <div role="group" aria-label={label} aria-busy={pending} className="flex items-center gap-1">
        {(["it", "en"] as const).map((l) => (
          <button key={l} type="button" lang={l} disabled={pending || l === current} aria-pressed={l === active}
            onClick={() => { setChosen(l); start(() => setLocale(l)); }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${l === active ? (onDark ? "bg-white text-ink" : "bg-ink text-white dark:bg-white dark:text-ink") : onDark ? "border border-white/30 hover:bg-white/10" : "border border-line hover:border-brand hover:text-brand"} disabled:cursor-default`}>
            {pending && l === chosen && <span className="spinner" aria-hidden="true" />}
            {LABELS[l]}
          </button>))}
      </div>
    </>
  );
}
