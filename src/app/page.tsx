import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { getChampionships, getRanking, type Championship, type RankingRow } from "@/lib/data";
import { getAccount } from "@/lib/account";
import { formatDeadline, registrationIsOpen } from "@/lib/registration";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/admin";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Caricamento…</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

function CodeBox() {
  return (
    <form action="/t" className="flex w-full max-w-md gap-2">
      <input name="codice" placeholder="Codice torneo" aria-label="Codice torneo" maxLength={6}
        className="min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2 uppercase text-white placeholder:text-white/60" />
      <button className="btn-primary">Segui</button>
    </form>
  );
}

async function HomeContent() {
  const [account, all] = await Promise.all([getAccount(), getChampionships()]);
  let mine = new Set<string>();
  if (account) {
    const { data } = await createServiceClient().from("championship_players").select("championship_id").eq("player_id", account.player.id);
    mine = new Set((data ?? []).map((r) => r.championship_id as string));
  }
  // Si vedono i campionati di cui fai parte e quelli resi pubblici dall'admin.
  const shown = all.filter((c) => mine.has(c.id) || c.isPublic)
    .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name, "it"));

  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
        <div className="relative p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/90" />
          <div aria-hidden="true" className="absolute -right-4 top-24 h-24 w-24 rounded-full bg-brand/40" />
          <div className="relative">
            <h1 className="text-4xl font-bold sm:text-5xl">{account ? `Ciao ${account.player.full_name.split(" ")[0]}!` : "Il tuo tennis tavolo"}</h1>
            <p className="mt-2 max-w-xl text-white/80">
              {account ? "I tuoi campionati, i tornei in corso e le iscrizioni aperte." : "Classifiche dei campionati, tornei in diretta, iscrizioni e amichevoli con gli amici."}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {account
                ? <><Link href="/amichevole/nuovo" className="btn-primary">Crea un amichevole</Link><Link href="/amici" className="btn border border-white/30 hover:bg-white/10">Amici</Link></>
                : <><Link href="/registrati" className="btn-primary">Registrati</Link><Link href="/login" className="btn border border-white/30 hover:bg-white/10">Accedi</Link></>}
            </div>
            <div className="mt-6"><p className="mb-1 text-sm text-white/70">Hai il codice di un torneo?</p><CodeBox /></div>
          </div>
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-bold uppercase">{account ? "I tuoi campionati" : "Campionati"}</h2>
      {shown.length === 0 ? (
        <p className="mt-3 text-muted">
          {account ? "Non fai ancora parte di nessun campionato: chiedi il link d'invito a chi lo organizza." : "Nessun campionato pubblico. Se hai ricevuto un invito, aprilo o accedi."}</p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {shown.map((c) => <ChampionshipCard key={c.id} c={c} member={mine.has(c.id)} myPlayerId={account?.player.id} />)}
        </div>
      )}
    </>
  );
}

const MEDAL = ["bg-gold", "bg-silver", "bg-bronze"];

async function ChampionshipCard({ c, member, myPlayerId }: { c: Championship; member: boolean; myPlayerId?: string }) {
  const [rows, { data: tournaments }] = await Promise.all([
    getRanking(c.id),
    createPublicClient().from("tournaments_public")
      .select("id, name, starts_on, status, public_code, championship_id, registration_open, registration_deadline, ranked")
      .eq("championship_id", c.id).neq("status", "closed").order("starts_on", { ascending: true, nullsFirst: false }),
  ]);
  const me = myPlayerId ? rows.find((r) => r.player_id === myPlayerId) : undefined;
  const live = (tournaments ?? []).filter((t) => t.status === "groups" || t.status === "knockout");
  const open = (tournaments ?? []).filter((t) => registrationIsOpen(t));
  const next = (tournaments ?? []).find((t) => t.status === "draft" && !registrationIsOpen(t));
  return (
    <article className="card flex flex-col !p-0">
      <div className="flex items-start justify-between gap-3 border-b-4 border-brand bg-ink px-5 py-4 text-white rounded-t-xl">
        <div>
          <h3 className="text-2xl font-bold uppercase">{c.name}</h3>
          <p className="text-sm text-white/70">{c.kind === "doubles" ? "Doppio" : "Singolare"} · {rows.length} giocatori</p>
        </div>
        {me && <div className="text-right"><p className="font-display text-3xl font-bold leading-none">#{me.position}</p>
          <p className="text-xs text-white/70">{me.rating} {c.settings.label.toLowerCase()}</p></div>}
      </div>
      <div className="flex-1 space-y-4 px-5 py-4">
        {rows.length > 0 ? <Podium rows={rows.slice(0, 3)} label={c.settings.label} myPlayerId={myPlayerId} /> : <p className="text-sm text-muted">Classifica ancora vuota.</p>}
        {(live.length > 0 || open.length > 0 || next) && (
          <ul className="space-y-2 text-sm">
            {live.map((t) => (
              <li key={t.id}><Link href={`/t/${t.public_code}`} className="flex items-center gap-2 hover:text-brand">
                <span className="badge-live"><span className="live-dot" /> In corso</span><span className="font-medium">{t.name}</span></Link></li>))}
            {open.map((t) => (
              <li key={t.id}><Link href={`/t/${t.public_code}`} className="flex flex-wrap items-center gap-2 hover:text-brand">
                <span className="badge-open">Iscrizioni aperte</span><span className="font-medium">{t.name}</span>
                {t.registration_deadline && <span className="text-muted">fino a {formatDeadline(t.registration_deadline)}</span>}</Link></li>))}
            {next && !live.length && !open.length && (
              <li><Link href={`/t/${next.public_code}`} className="flex items-center gap-2 hover:text-brand">
                <span className="badge-muted">Prossimo</span><span className="font-medium">{next.name}</span>
                {next.starts_on && <span className="text-muted">{new Date(next.starts_on).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}</span>}</Link></li>)}
          </ul>)}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        {!member && myPlayerId ? <Link href={`/partecipa/${c.slug}`} className="text-sm link">Chiedi di partecipare</Link> : <span />}
        <Link href={`/c/${c.slug}`} className="btn-dark py-1.5 text-sm">Apri il campionato →</Link>
      </div>
    </article>
  );
}

function Podium({ rows, label, myPlayerId }: { rows: RankingRow[]; label: string; myPlayerId?: string }) {
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.player_id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${r.player_id === myPlayerId ? "bg-gold/15" : ""}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-sm font-bold text-white ${MEDAL[i]}`}>{r.position}</span>
          <Avatar name={r.full_name} size="h-7 w-7 text-[0.65rem]" />
          <Link href={`/giocatore/${r.player_id}`} className="flex-1 truncate font-medium hover:text-brand">{r.full_name}</Link>
          <span className="font-display text-lg font-semibold tabular-nums">{r.rating}<span className="ml-1 text-xs font-normal text-muted">{label.toLowerCase()}</span></span>
        </li>))}
    </ol>
  );
}
