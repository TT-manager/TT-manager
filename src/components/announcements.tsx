import { ActionForm } from "@/components/action-form";
import { AnnouncementForm } from "@/components/announcement-form";
import { deleteAnnouncementAction, pinAnnouncementAction } from "@/app/avvisi/actions";
import { countAnnouncements, listAnnouncements, pageAnnouncements, type AnnouncementTarget } from "@/lib/announcements";
import { AnnouncementsView } from "@/components/announcements-view";
import { Icon } from "@/components/icons";
import { hasServiceKey } from "@/lib/organizer";
import { timeAgo } from "@/lib/time";
import { getLocale, tr } from "@/i18n/server";
import { announcementsText } from "@/i18n/dict/announcements";

/**
 * Riquadro pubblico in cima alla pagina del circuito o del torneo: avvisi in evidenza più quelli recenti
 * (`sinceDays`). Il resto (uno solo grande, gli altri raccolti, la × per nasconderli) lo fa AnnouncementsView.
 */
export async function AnnouncementsBox({ target, sinceDays }: { target: AnnouncementTarget; sinceDays?: number }) {
  if (!hasServiceKey()) return null;
  const items = await pageAnnouncements(target, sinceDays);
  if (!items.length) return null;
  const l = await getLocale();
  const now = new Date();
  return <AnnouncementsView items={items.map((a) => ({ id: a.id, body: a.body, pinned: a.pinned, when: timeAgo(a.created_at, now, l) }))} />;
}

const keyOf = (target: AnnouncementTarget) => ("championshipId" in target ? `c:${target.championshipId}` : `t:${target.tournamentId}`);

/** Un avviso già inviato, nelle liste di gestione: testo, evidenza, data, e i comandi per l'evidenza e la cancellazione. */
export async function SentAnnouncement({ a, targetKey, when, label }: {
  a: { id: number; body: string; pinned: boolean }; targetKey: string; when: string; label?: string;
}) {
  const t = await tr(announcementsText);
  const ids = <><input type="hidden" name="target" value={targetKey} /><input type="hidden" name="id" value={a.id} /></>;
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <span className="min-w-0">
        {label && <span className="text-xs font-bold uppercase tracking-wide text-brand">{label}</span>}
        <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          {a.pinned && <><Icon name="pin" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> {t.pinnedBadge} · </>}{when}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <ActionForm action={pinAnnouncementAction} submitLabel={a.pinned ? t.unpin : t.pin} primary={false} inline>
          {ids}<input type="hidden" name="on" value={a.pinned ? "0" : "1"} />
        </ActionForm>
        <ActionForm action={deleteAnnouncementAction} submitLabel={t.remove} confirmText={t.removeConfirm} primary={false} inline>{ids}</ActionForm>
      </span>
    </li>
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
            {items.map((a) => <SentAnnouncement key={a.id} a={a} targetKey={keyOf(target)} when={timeAgo(a.created_at, now, l)} />)}
          </ul>
        </>)}
    </section>
  );
}

/** Per chi gestisce un amichevole senza essere amministratore: il riquadro avvisi, chiuso finché non lo apre. */
export async function AnnouncementsCollapsible({ tournamentId }: { tournamentId: string }) {
  const t = await tr(announcementsText);
  const n = hasServiceKey() ? await countAnnouncements({ tournamentId }) : 0;
  return (
    <details className="card">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Icon name="notice" className="h-5 w-5 text-brand" /> {t.summary(n)}</summary>
      <div className="mt-2"><AnnouncementsAdmin target={{ tournamentId }} /></div>
    </details>
  );
}
