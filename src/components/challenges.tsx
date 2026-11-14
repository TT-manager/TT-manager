import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { MatchForm } from "@/components/match-form";
import { getAccount } from "@/lib/account";
import {
  challengeableMembers, disputedChallenges, latestChallenges, leagueNames, openChallengesOf, playerNames, type Challenge,
} from "@/lib/challenges";
import { CHALLENGE_BEST_OF, daysLeft } from "@/lib/domain/challenges";
import { DEFAULT_SET_RULES } from "@/lib/domain/score";
import type { Championship } from "@/lib/data";
import { answerChallengeAction, answerResultAction, reportChallengeAction, sendChallengeAction } from "@/app/sfide/actions";
import { settleChallengeAction, decideChallengeAction } from "@/app/admin/campionati/actions";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { challengesText } from "@/i18n/dict/challenges";

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const score = (c: Challenge) => <span className="rounded bg-ink px-2 py-0.5 font-display font-bold tabular-nums text-white dark:bg-neutral-700">{c.sets_a}-{c.sets_b}</span>;

/** Pulsante singolo che invia un'azione sulla sfida (accetta, rifiuta, conferma…). */
function Act({ action, id, answer, label, confirmText, primary = false }: {
  action: typeof answerChallengeAction; id: string; answer: string; label: string; confirmText?: string; primary?: boolean;
}) {
  return (
    <ActionForm action={action} submitLabel={label} confirmText={confirmText} primary={primary} inline={!primary} className="inline-block">
      <input type="hidden" name="challenge_id" value={id} />
      <input type="hidden" name="answer" value={answer} />
    </ActionForm>
  );
}

/** Sezione «Sfide» della pagina della lega: lanciare una sfida e ultime sfide giocate. Va dentro <Suspense>. */
export async function LeagueChallenges({ c }: { c: Championship }) {
  const s = c.settings.challenges;
  const latest = c.kind === "singles" ? await latestChallenges(c.id) : [];
  if (c.kind !== "singles" || (!s.enabled && latest.length === 0)) return null;
  const [t, l, account, members] = [await tr(challengesText), await getLocale(), await getAccount(), await challengeableMembers(c.id)];
  const me = account?.player.id;
  // Chi ha un account ed è nella lega compare tra i membri sfidabili.
  const isMember = Boolean(me && members.some((m) => m.id === me));
  const names = await playerNames(latest.flatMap((x) => [x.challenger_id, x.opponent_id]));
  const opponents = members.filter((m) => m.id !== me);

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold uppercase">{t.sectionTitle}</h2>
      {s.enabled && (
        <div className="card mt-3">
          <p className="text-sm text-muted">{t.sectionIntro(s.weight, s.perWeek)}</p>
          {!account ? <p className="mt-3 text-sm"><Link href={`/login?next=/c/${c.slug}`} className="link">{t.loginToChallenge}</Link></p>
            : !isMember ? null
            : opponents.length === 0 ? <p className="mt-3 text-sm text-muted">{t.noOpponents}</p>
            : (
              <ActionForm action={sendChallengeAction} submitLabel={t.send} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="championship_id" value={c.id} />
                <input type="hidden" name="back" value={`/c/${c.slug}`} />
                <label className="grid gap-1 text-sm">{t.opponent}
                  <select name="opponent_id" required defaultValue="" className="select-arrow rounded border bg-transparent px-3 py-2">
                    <option value="" disabled>{t.chooseOpponent}</option>
                    {opponents.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select></label>
                <label className="grid gap-1 text-sm">{t.bestOf}
                  <select name="best_of" defaultValue="3" className="select-arrow rounded border bg-transparent px-3 py-2">
                    {CHALLENGE_BEST_OF.map((n) => <option key={n} value={n}>{t.sets(n)}</option>)}
                  </select></label>
              </ActionForm>)}
        </div>)}

      <h3 className="mt-6 text-lg font-bold uppercase">{t.latest}</h3>
      {latest.length === 0 ? <p className="mt-2 text-muted">{t.noneYet}</p> : (
        <ul className="card mt-3 divide-y divide-line !py-1">
          {latest.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>
                <span className="text-xs text-muted">{new Date(x.played_at ?? x.created_at).toLocaleDateString(intlTag(l), { day: "numeric", month: "short" })}</span><br />
                <span className="font-medium">{names.get(x.challenger_id)}</span> <span className="text-muted">vs</span> <span className="font-medium">{names.get(x.opponent_id)}</span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                {score(x)}
                {x.ranked && x.deltaChallenger !== null && x.deltaOpponent !== null
                  ? <span className="tabular-nums text-muted">{sign(x.deltaChallenger)} / {sign(x.deltaOpponent)}</span>
                  : <span className="badge-friendly">{t.friendly}</span>}
              </span>
            </li>))}
        </ul>)}
    </section>
  );
}

/** «Le mie sfide» nella dashboard: tutte le sfide aperte del giocatore, con le azioni possibili. */
export async function MyChallenges({ playerId, className = "" }: { playerId: string; className?: string }) {
  const open = await openChallengesOf(playerId);
  if (!open.length) return null;
  const [t, names, leagues] = [
    await tr(challengesText),
    await playerNames(open.flatMap((c) => [c.challenger_id, c.opponent_id])),
    await leagueNames(open.map((c) => c.championship_id)),
  ];
  return (
    <section id="sfide" className={`card scroll-mt-24 ${className}`}>
      <h2 className="text-xl font-bold uppercase">{t.myTitle}</h2>
      <ul className="mt-2 divide-y divide-line">
        {open.map((c) => {
          const other = c.challenger_id === playerId ? c.opponent_id : c.challenger_id;
          const name = names.get(other) ?? "?";
          const league = leagues.get(c.championship_id);
          const iChallenged = c.challenger_id === playerId;
          const a = names.get(c.challenger_id) ?? "?", b = names.get(c.opponent_id) ?? "?";
          const text =
            c.status === "pending" ? (iChallenged ? t.waitingAccept(name) : t.challengedYou(name))
            : c.status === "accepted" ? t.acceptedWith(name)
            : c.status === "reported" ? (c.reported_by === playerId ? t.waitingConfirm(name) : t.toConfirm(name))
            : t.disputedWait;
          return (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {league ? <Link href={`/c/${league.slug}`} className="hover:text-brand">{league.name}</Link> : null} · {t.bestOfShort(c.best_of)}
                    {(c.status === "pending" || c.status === "accepted") && <> · {t.expiresIn(daysLeft(c))}</>}
                  </span><br />
                  <span className="font-medium">{text}</span>
                </span>
                {c.sets_a !== null && <span className="text-sm">{a} {score(c)} {b}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {c.status === "pending" && !iChallenged && <>
                  <Act action={answerChallengeAction} id={c.id} answer="accept" label={t.accept} primary />
                  <Act action={answerChallengeAction} id={c.id} answer="decline" label={t.decline} />
                </>}
                {c.status === "pending" && iChallenged &&
                  <Act action={answerChallengeAction} id={c.id} answer="cancel" label={t.cancel} confirmText={t.confirmCancel} />}
                {c.status === "accepted" && <>
                  <MatchForm action={reportChallengeAction} hidden={{}} matchId={c.id} bestOf={c.best_of} rules={DEFAULT_SET_RULES} a={a} b={b} initial={null} />
                  <Act action={answerChallengeAction} id={c.id} answer="cancel" label={t.cancel} confirmText={t.confirmCancel} />
                </>}
                {c.status === "reported" && c.reported_by === playerId &&
                  <MatchForm action={reportChallengeAction} hidden={{}} matchId={c.id} bestOf={c.best_of} rules={DEFAULT_SET_RULES} a={a} b={b} initial={c.set_scores} />}
                {c.status === "reported" && c.reported_by !== playerId && <>
                  <Act action={answerResultAction} id={c.id} answer="confirm" label={t.confirm} primary />
                  <Act action={answerResultAction} id={c.id} answer="dispute" label={t.dispute} confirmText={t.confirmDispute} />
                </>}
              </div>
            </li>);
        })}
      </ul>
    </section>
  );
}

/** Sfide contestate, nella pagina di amministrazione della lega. */
export async function DisputedChallenges({ championshipId }: { championshipId: string }) {
  const list = await disputedChallenges(championshipId);
  if (!list.length) return null;
  const t = await tr(challengesText);
  const names = await playerNames(list.flatMap((c) => [c.challenger_id, c.opponent_id]));
  return (
    <section className="space-y-3 rounded-lg border border-amber-400 p-4">
      <h2 className="text-lg font-semibold">{t.adminTitle}</h2>
      <p className="text-sm text-muted">{t.adminIntro}</p>
      <ul className="divide-y divide-line">
        {list.map((c) => {
          const a = names.get(c.challenger_id) ?? "?", b = names.get(c.opponent_id) ?? "?";
          const disputer = c.reported_by === c.challenger_id ? b : a;
          return (
            <li key={c.id} className="space-y-2 py-3">
              <p><span className="font-medium">{a}</span> {score(c)} <span className="font-medium">{b}</span>
                <span className="ml-2 text-sm text-muted">{t.reportedBy(names.get(c.reported_by ?? "") ?? "?")} · {t.disputedBy(disputer)}</span></p>
              <div className="flex flex-wrap items-center gap-3">
                <ActionForm action={settleChallengeAction} submitLabel={t.confirmResult} className="inline-block">
                  <input type="hidden" name="championship_id" value={championshipId} />
                  <input type="hidden" name="challenge_id" value={c.id} />
                  <input type="hidden" name="decision" value="confirm" />
                </ActionForm>
                <MatchForm action={decideChallengeAction} hidden={{ championship_id: championshipId }} matchId={c.id} bestOf={c.best_of} rules={DEFAULT_SET_RULES} a={a} b={b} initial={c.set_scores} />
                <ActionForm action={settleChallengeAction} submitLabel={t.annul} confirmText={t.confirmAnnul} primary={false} inline className="inline-block">
                  <input type="hidden" name="championship_id" value={championshipId} />
                  <input type="hidden" name="challenge_id" value={c.id} />
                </ActionForm>
              </div>
            </li>);
        })}
      </ul>
    </section>
  );
}
