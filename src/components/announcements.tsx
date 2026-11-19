import { ActionForm } from "@/components/action-form";
import { AnnouncementForm } from "@/components/announcement-form";
import { deleteAnnouncementAction } from "@/app/avvisi/actions";
import Link from "next/link";
import { countAnnouncements, listAnnouncements, type AnnouncementTarget } from "@/lib/announcements";
import { hasServiceKey } from "@/lib/organizer";
import { timeAgo } from "@/lib/time";
import { getLocale, tr } from "@/i18n/server";
import { announcementsText } from "@/i18n/dict/announcements";

const hidden = (target: AnnouncementTarget) => "championshipId" in target
  ? <input type="hidden" name="championship_id" value={target.championshipId} />
  : <input type="hidden" name="tournament_id" value={target.tournamentId} />;

/** Riquadro pubblico con gli ultimi avvisi (in cima alla pagina del circuito o del torneo). Niente se non ce ne sono. */
export async function AnnouncementsBox({ target, limit = 3, sinceDays }: { target: AnnouncementTarget; limit?: number; sinceDays?: number }) {
  if (!hasServiceKey()) return null;
  const items = await listAnnouncements(target, { limit, sinceDays });
  if (!items.length) return null;
  const [t, l] = [await tr(announcementsText), await getLocale()];
  const now = new Date();
  return (
    <section className="mt-6 rounded-xl border-2 border-amber-400 bg-amber-400/10 p-4" aria-label={t.boxTitle}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase"><span aria-hidden="true">📣</span> {t.boxTitle}</h2>
      <ul className="mt-2 divide-y divide-amber-400/30">
        {items.map((a) => (
          <li key={a.id} className="py-2">
            <p className="whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</p>
            <p className="mt-0.5 text-xs text-muted">{timeAgo(a.created_at, now, l)}</p>
          </li>))}
      </ul>
    </section>
  );
}

/** Sezione di gestione: scrivere un avviso e vedere (o cancellare) quelli inviati. */
export async function AnnouncementsAdmin({ target }: { target: AnnouncementTarget }) {
  const [t, l] = [await tr(announcementsText), await getLocale()];
  const league = "championshipId" in target;
  const items = hasServiceKey() ? await listAnnouncements(target, { limit: 20 }) : [];
  const now = new Date();
  return (
    <section>
      <h2 className="text-lg font-semibold">{league ? t.adminTitleLeague : t.adminTitleTournament}</h2>
      <p className="text-sm text-muted">{league ? t.adminIntroLeague : t.adminIntroTournament}</p>
      <AnnouncementForm field={league ? "championship_id" : "tournament_id"} id={league ? target.championshipId : target.tournamentId} />
      {items.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">{t.sentList}</h3>
          <ul className="mt-1 divide-y divide-line">
            {items.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</span>
                  <span className="text-xs text-muted">{timeAgo(a.created_at, now, l)}</span>
                </span>
                <ActionForm action={deleteAnnouncementAction} submitLabel={t.remove} confirmText={t.removeConfirm} primary={false} inline>
                  {hidden(target)}<input type="hidden" name="id" value={a.id} />
                </ActionForm>
              </li>))}
          </ul>
        </>)}
    </section>
  );
}

/** Link alla sezione Avvisi con il circuito o il torneo già scelto (nelle pagine di gestione). */
export async function AnnouncementsLink({ target }: { target: AnnouncementTarget }) {
  const t = await tr(announcementsText);
  const n = hasServiceKey() ? await countAnnouncements(target) : 0;
  const key = "championshipId" in target ? `c:${target.championshipId}` : `t:${target.tournamentId}`;
  return (
    <Link href={`/admin/avvisi?a=${key}`} title={t.linkHint}
      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm hover:border-brand hover:text-brand">
      {t.link(n)} <span aria-hidden="true">›</span></Link>
  );
}

/** Per chi gestisce un amichevole senza essere amministratore: il riquadro avvisi, chiuso finché non lo apre. */
export async function AnnouncementsCollapsible({ tournamentId }: { tournamentId: string }) {
  const t = await tr(announcementsText);
  const n = hasServiceKey() ? await countAnnouncements({ tournamentId }) : 0;
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">{t.summary(n)}</summary>
      <div className="mt-2"><AnnouncementsAdmin target={{ tournamentId }} /></div>
    </details>
  );
}
