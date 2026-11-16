import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { MatchForm } from "@/components/match-form";
import { getAccount } from "@/lib/account";
import {
  challengeableMembers, closedNoticesOf, disputedChallenges, latestChallenges, leagueNames, matchupKey, openChallengesOf, playerNames,
  rulesOf, sideOf, sideOfPlayer, type Challenge,
} from "@/lib/challenges";
import { CHALLENGE_BEST_OF, daysLeft } from "@/lib/domain/challenges";
import { SetPointsField } from "@/components/set-points-field";
import type { Championship } from "@/lib/data";
import { answerChallengeAction, answerResultAction, reportChallengeAction, sendChallengeAction } from "@/app/sfide/actions";
import { settleChallengeAction, decideChallengeAction } from "@/app/admin/campionati/actions";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { challengesText } from "@/i18n/dict/challenges";

/** Nomi di un lato della sfida: «Mario» nel singolo, «Mario / Luca» nel doppio. */
const sideName = (c: Challenge, side: "a" | "b", names: Map<string, string>) =>
  sideOf(c, side).map((id) => names.get(id) ?? "?").join(" / ");
const everyoneIn = (list: Challenge[]) => list.flatMap((c) => [...sideOf(c, "a"), ...sideOf(c, "b")]);
const select = "select-arrow w-full rounded border bg-transparent px-3 py-2";

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
  const doubles = c.kind === "doubles";
  const latest = await latestChallenges(c.id);
  if (!s.enabled && latest.length === 0) return null;
  const [t, l, account, members] = [await tr(challengesText), await getLocale(), await getAccount(), await challengeableMembers(c.id)];
  const me = account?.player.id;
  const isMember = Boolean(me && members.some((m) => m.id === me));
  const names = await playerNames(everyoneIn(latest));
  const others = members.filter((m) => m.id !== me);
  // Nel singolo si sfida chi ha un account; nel doppio basta che uno dei due avversari ce l'abbia.
  const canChallenge = doubles ? others.length >= 3 && others.some((m) => m.hasAccount) : others.some((m) => m.hasAccount);
  const options = (list: typeof others) => list.map((m) => <option key={m.id} value={m.id}>{m.name}</option>);

  return (
    <section id="sfide-circuito" className="mt-10 scroll-mt-24">
      <h2 className="text-2xl font-bold uppercase">{t.sectionTitle}</h2>
      {s.enabled && <div className="card mt-3">
          <p className="text-sm text-muted">{doubles ? t.sectionIntroDoubles(s.weight, s.perWeek) : t.sectionIntro(s.weight, s.perWeek)}</p>
          {!account ? <p className="mt-3 text-sm"><Link href={`/login?next=/c/${c.slug}`} className="link">{t.loginToChallenge}</Link></p>
            : !isMember ? null
            : !canChallenge ? <p className="mt-3 text-sm text-muted">{doubles ? t.noOpponentsDoubles : t.noOpponents}</p>
            : (
              <ActionForm action={sendChallengeAction} submitLabel={t.send}
                className={doubles ? "mt-3 grid gap-3 sm:grid-cols-2" : "mt-3 flex flex-wrap items-end gap-3"}>
                <input type="hidden" name="championship_id" value={c.id} />
                <input type="hidden" name="back" value={`/c/${c.slug}`} />
                {doubles ? <>
                  <label className="grid gap-1 text-sm">{t.partner}
                    <select name="partner_id" required defaultValue="" className={select}>
                      <option value="" disabled>{t.chooseOpponent}</option>{options(others)}
                    </select></label>
                  <fieldset className="grid gap-1 text-sm">
                    <legend className="mb-1">{t.opponents}</legend>
                    <select name="opponent_id" required defaultValue="" aria-label={`${t.opponents} 1`} className={select}>
                      <option value="" disabled>{t.chooseOpponent}</option>{options(others)}
                    </select>
                    <select name="opponent_partner_id" required defaultValue="" aria-label={`${t.opponents} 2`} className={`mt-2 ${select}`}>
                      <option value="" disabled>{t.chooseOpponent}</option>{options(others)}
                    </select>
                  </fieldset>
                </> : (
                  <label className="grid gap-1 text-sm">{t.opponent}
                    <select name="opponent_id" required defaultValue="" className={select}>
                      <option value="" disabled>{t.chooseOpponent}</option>{options(others.filter((m) => m.hasAccount))}
                    </select></label>)}
                <label className="grid gap-1 text-sm">{t.bestOf}
                  <select name="best_of" defaultValue="3" className={select}>
                    {CHALLENGE_BEST_OF.map((n) => <option key={n} value={n}>{t.sets(n)}</option>)}
                  </select></label>
                <SetPointsField label={t.setPoints} customLabel={t.customPoints} className={select} />
              </ActionForm>)}
      </div>}

      <h3 className="mt-6 text-lg font-bold uppercase">{t.latest}</h3>
      {latest.length === 0 ? <p className="mt-2 text-muted">{t.noneYet}</p> : (
        <ul className="card mt-3 divide-y divide-line !py-1">
          {latest.map((x) => {
            const delta = (side: "a" | "b") => {
              const d = sideOf(x, side).map((id) => x.deltas?.get(id) ?? null);
              if (d.some((v) => v === null)) return null;
              // I compagni possono aver preso punti diversi: «+8», oppure «+8/+10».
              return [...new Set(d as number[])].map(sign).join("/");
            };
            const da = delta("a"), db = delta("b");
            return (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <span className="text-xs text-muted">{new Date(x.played_at ?? x.created_at).toLocaleDateString(intlTag(l), { day: "numeric", month: "short" })}</span><br />
                  <span className="font-medium">{sideName(x, "a", names)}</span> <span className="text-muted">vs</span> <span className="font-medium">{sideName(x, "b", names)}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  {score(x)}
                  {x.ranked && da !== null && db !== null
                    ? <span className="tabular-nums text-muted">{da} · {db}</span>
                    : <span className="badge-muted">{t.notCounted}</span>}
                </span>
              </li>);
          })}
        </ul>)}
    </section>
  );
}

/** «Le mie sfide» nella dashboard: tutte le sfide aperte del giocatore, con le azioni possibili. */
export async function MyChallenges({ playerId, className = "" }: { playerId: string; className?: string }) {
  const [open, closed] = await Promise.all([openChallengesOf(playerId), closedNoticesOf(playerId)]);
  // Se con lo stesso avversario c'è già una sfida aperta (es. dopo «Sfida di nuovo»), l'avviso non serve più.
  const pairKey = (c: Challenge) => `${c.championship_id}:${matchupKey(c)}`;
  const openPairs = new Set(open.map(pairKey));
  const notices = closed.filter((c, i) => !openPairs.has(pairKey(c)) && closed.findIndex((x) => pairKey(x) === pairKey(c)) === i);
  if (!open.length && !notices.length) return null;
  const all = [...open, ...notices];
  const [t, names, leagues] = [
    await tr(challengesText),
    await playerNames(everyoneIn(all)),
    await leagueNames(all.map((c) => c.championship_id)),
  ];
  return (
    <section id="sfide" className={`card scroll-mt-24 ${className}`}>
      <h2 className="text-xl font-bold uppercase">{t.myTitle}</h2>
      <ul className="mt-2 divide-y divide-line">
        {open.map((c) => {
          const mine = sideOfPlayer(c, playerId) ?? "a";
          const name = sideName(c, mine === "a" ? "b" : "a", names);
          const league = leagues.get(c.championship_id);
          const iChallenged = mine === "a";
          // Il risultato l'ha inserito il mio lato (io o il mio compagno): posso correggerlo, l'altro lato conferma.
          const ourReport = sideOfPlayer(c, c.reported_by ?? "") === mine;
          const a = sideName(c, "a", names), b = sideName(c, "b", names);
          const text =
            c.status === "pending" ? (iChallenged ? t.waitingAccept(name) : t.challengedYou(name))
            : c.status === "accepted" ? t.acceptedWith(name)
            : c.status === "reported" ? (ourReport ? t.waitingConfirm(name) : t.toConfirm(name))
            : t.disputedWait;
          return (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {league ? <Link href={`/c/${league.slug}`} className="hover:text-brand">{league.name}</Link> : null} · {t.bestOfShort(c.best_of)} · {t.pointsShort(c.set_points)}
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
                  <MatchForm action={reportChallengeAction} hidden={{}} matchId={c.id} bestOf={c.best_of} rules={rulesOf(c)} a={a} b={b} initial={null} />
                  <Act action={answerChallengeAction} id={c.id} answer="cancel" label={t.cancel} confirmText={t.confirmCancel} />
                </>}
                {c.status === "reported" && ourReport &&
                  <MatchForm action={reportChallengeAction} hidden={{}} matchId={c.id} bestOf={c.best_of} rules={rulesOf(c)} a={a} b={b} initial={c.set_scores} />}
                {c.status === "reported" && !ourReport && <>
                  <Act action={answerResultAction} id={c.id} answer="confirm" label={t.confirm} primary />
                  <Act action={answerResultAction} id={c.id} answer="dispute" label={t.dispute} confirmText={t.confirmDispute} />
                </>}
              </div>
            </li>);
        })}
        {notices.map((c) => {
          const mine = sideOfPlayer(c, playerId) ?? "a";
          const theirs = sideOf(c, mine === "a" ? "b" : "a");
          const partner = sideOf(c, mine).find((id) => id !== playerId);
          const name = sideName(c, mine === "a" ? "b" : "a", names);
          const text = c.reason === "declined" ? t.noticeDeclined(name)
            : c.reason === "cancelled" ? t.noticeCancelled(names.get(c.cancelled_by ?? "") ?? name) : t.noticeExpired(name);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="text-muted">{text}</span>
              <ActionForm action={sendChallengeAction} submitLabel={t.challengeAgain} primary={false} inline className="inline-block">
                <input type="hidden" name="championship_id" value={c.championship_id} />
                <input type="hidden" name="opponent_id" value={theirs[0]} />
                {partner && <input type="hidden" name="partner_id" value={partner} />}
                {theirs[1] && <input type="hidden" name="opponent_partner_id" value={theirs[1]} />}
                <input type="hidden" name="best_of" value={c.best_of} />
                <input type="hidden" name="set_points" value={c.set_points} />
              </ActionForm>
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
  const names = await playerNames(everyoneIn(list));
  return (
    <section className="space-y-3 rounded-lg border border-amber-400 p-4">
      <h2 className="text-lg font-semibold">{t.adminTitle}</h2>
      <p className="text-sm text-muted">{t.adminIntro}</p>
      <ul className="divide-y divide-line">
        {list.map((c) => {
          const a = sideName(c, "a", names), b = sideName(c, "b", names);
          // Ha contestato l'altro lato rispetto a chi ha inserito il risultato.
          const disputer = sideOfPlayer(c, c.reported_by ?? "") === "a" ? b : a;
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
                <MatchForm action={decideChallengeAction} hidden={{ championship_id: championshipId }} matchId={c.id} bestOf={c.best_of} rules={rulesOf(c)} a={a} b={b} initial={c.set_scores} />
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
