import Link from "next/link";
import { statusLabel } from "@/lib/labels";
import type { Locale } from "@/i18n/locale";
import { intlTag } from "@/i18n/locale";

/** Ordine nell'elenco: prima quelli in corso, poi in preparazione, infine i chiusi. */
export const tournamentOrder = (status: string) => (status === "groups" || status === "knockout" ? 0 : status === "draft" ? 1 : 2);

/** Scheda di un torneo negli elenchi dell'amministrazione: tutta la scheda porta alla gestione. */
export function AdminTournamentCard({ t, l, sub, friendlyLabel, noDate, code }: {
  t: { id: string; name: string; starts_on: string | null; status: string; ranked: boolean; public_code?: string };
  l: Locale; sub?: string | null; friendlyLabel: string | null; noDate: string; code?: string;
}) {
  const live = t.status === "groups" || t.status === "knockout";
  const closed = t.status === "closed";
  return (
    <Link href={`/gestione/${t.id}`}
      className={`card flex h-full items-center justify-between gap-3 border-l-4 transition hover:border-brand ${live ? "!border-l-brand" : closed ? "!border-l-neutral-500 opacity-80" : "!border-l-neutral-300 dark:!border-l-neutral-600"}`}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          {live ? <span className="badge-live"><span className="live-dot" /> {statusLabel(t.status, l)}</span>
            : <span className="badge-muted">{statusLabel(t.status, l)}</span>}
          {friendlyLabel && <span className="badge-friendly">{friendlyLabel}</span>}
        </span>
        <span className="mt-1.5 block truncate font-display text-lg font-bold uppercase">{t.name}</span>
        <span className="block text-sm text-muted">
          {[sub, t.starts_on ? new Date(t.starts_on).toLocaleDateString(intlTag(l), { day: "numeric", month: "short", year: "numeric" }) : noDate, code]
            .filter(Boolean).join(" · ")}
        </span>
      </span>
      <span aria-hidden="true" className="text-2xl text-muted">›</span>
    </Link>
  );
}
