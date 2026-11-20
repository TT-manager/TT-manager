"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { useTr } from "@/i18n/client";
import { announcementsText } from "@/i18n/dict/announcements";

export type ShownAnnouncement = { id: number; body: string; when: string; pinned: boolean };

// Avvisi nascosti da chi guarda: restano solo su questo dispositivo (nessun dato in più sul server).
const KEY = "pf_avvisi_nascosti";
const EVENT = "pf-avvisi";
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb); window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb); };
};
function hide(id: number) {
  try {
    const ids = read() ? (JSON.parse(read()) as number[]) : [];
    localStorage.setItem(KEY, JSON.stringify([...ids.filter((x) => x !== id), id].slice(-200)));
  } catch { /* senza memoria del browser semplicemente non si nasconde */ }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Avvisi in cima alla pagina del circuito o del torneo, senza riempirla:
 * quelli in evidenza sempre (non si nascondono), poi un solo avviso normale e gli altri raccolti sotto «Altri n avvisi».
 */
export function AnnouncementsView({ items }: { items: ShownAnnouncement[] }) {
  const t = useTr(announcementsText);
  const raw = useSyncExternalStore(subscribe, read, () => "");
  let hidden = new Set<number>();
  try { hidden = new Set(raw ? (JSON.parse(raw) as number[]) : []); } catch { /* valore rovinato: si ignora */ }
  const pinned = items.filter((a) => a.pinned);
  const normal = items.filter((a) => !a.pinned && !hidden.has(a.id));
  if (!pinned.length && !normal.length) return null;
  const [first, ...rest] = normal;

  const row = (a: ShownAnnouncement) => (
    <div key={a.id} className="flex items-start gap-3 py-2">
      <span aria-hidden="true" className="mt-0.5 text-amber-600 dark:text-amber-400"><Icon name={a.pinned ? "pin" : "notice"} className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</span>
        <span className="text-xs text-muted">{a.pinned ? `${t.pinnedBadge} · ` : ""}{a.when}</span>
      </span>
      {!a.pinned && (
        <button type="button" onClick={() => hide(a.id)} aria-label={t.hide} title={t.hide}
          className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-amber-400/20 hover:text-foreground">
          <Icon name="close" className="h-4 w-4" /></button>)}
    </div>);

  return (
    <section className="mt-6 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-4 py-2" aria-label={t.boxTitle}>
      <div className="divide-y divide-amber-400/30">
        {pinned.map(row)}
        {first && row(first)}
      </div>
      {rest.length > 0 && (
        <details className="group border-t border-amber-400/30">
          <summary className="flex cursor-pointer list-none items-center gap-1 py-2 text-sm text-muted [&::-webkit-details-marker]:hidden">
            {t.more(rest.length)} <span aria-hidden="true" className="transition group-open:rotate-90">›</span></summary>
          <div className="divide-y divide-amber-400/30">{rest.map(row)}</div>
        </details>)}
    </section>
  );
}
