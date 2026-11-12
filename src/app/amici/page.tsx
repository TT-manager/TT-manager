import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { answerFriend, sendFriendRequest } from "./actions";

export const metadata = { title: "Amici" };
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

export default function FriendsPage({ searchParams }: PageProps<"/amici">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/profilo" className={`${muted} hover:underline`}>← Il mio profilo</Link>
      <h1 className="mt-2 text-3xl font-bold">Amici</h1>
      <Suspense fallback={<p className={`mt-6 ${muted}`}>Caricamento…</p>}><Friends searchParams={searchParams} /></Suspense>
    </main>
  );
}

type Row = { userId: string; playerId: string; name: string; club: string | null };

async function Friends({ searchParams }: { searchParams: PageProps<"/amici">["searchParams"] }) {
  const me = await requireAccount("/amici");
  const q = String((await searchParams).cerca ?? "").trim().slice(0, 60);
  const svc = createServiceClient();
  const { data: rel } = await svc.from("friendships").select("user_a, user_b, status, requested_by")
    .or(`user_a.eq.${me.userId},user_b.eq.${me.userId}`);
  const rows = (rel ?? []).map((f) => ({ other: (f.user_a === me.userId ? f.user_b : f.user_a) as string, status: f.status as string, mine: f.requested_by === me.userId }));
  const others = rows.map((r) => r.other);
  const { data: people } = others.length ? await svc.from("players").select("id, user_id, full_name, club").in("user_id", others) : { data: [] };
  const byUser = new Map((people ?? []).map((p) => [p.user_id as string, { userId: p.user_id as string, playerId: p.id as string, name: p.full_name as string, club: p.club as string | null }]));
  const get = (u: string): Row => byUser.get(u) ?? { userId: u, playerId: "", name: "?", club: null };
  const friends = rows.filter((r) => r.status === "accepted").map((r) => get(r.other)).sort((a, b) => a.name.localeCompare(b.name, "it"));
  const incoming = rows.filter((r) => r.status === "pending" && !r.mine).map((r) => get(r.other));
  const outgoing = rows.filter((r) => r.status === "pending" && r.mine).map((r) => get(r.other));

  // Ricerca tra i giocatori con un account (nome, non email).
  let results: Row[] = [];
  if (q.length >= 2) {
    const safe = q.replace(/[%_,()\\]/g, " ");
    const { data } = await svc.from("players").select("id, user_id, full_name, club").not("user_id", "is", null)
      .ilike("full_name", `%${safe}%`).neq("user_id", me.userId).order("full_name").limit(20);
    results = (data ?? []).map((p) => ({ userId: p.user_id as string, playerId: p.id as string, name: p.full_name as string, club: p.club as string | null }));
  }
  const related = new Map(rows.map((r) => [r.other, r]));
  const person = (r: Row) => <><Link href={`/giocatore/${r.playerId}`} className="font-medium hover:underline">{r.name}</Link>{r.club && <span className={muted}> · {r.club}</span>}</>;
  const answer = (r: Row, decision: "accept" | "remove", label: string, confirmText?: string) => (
    <ActionForm action={answerFriend} submitLabel={label} primary={decision === "accept"} inline={decision !== "accept"} confirmText={confirmText}>
      <input type="hidden" name="user_id" value={r.userId} /><input type="hidden" name="decision" value={decision} />
    </ActionForm>
  );

  return (
    <div className="mt-6 space-y-10">
      {incoming.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Richieste ricevute</h2>
          <ul className="mt-2 divide-y">
            {incoming.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center gap-4 py-2">{person(r)}{answer(r, "accept", "Accetta")}{answer(r, "remove", "Rifiuta")}</li>))}
          </ul>
        </section>)}

      <section>
        <h2 className="text-xl font-semibold">I miei amici ({friends.length})</h2>
        {friends.length === 0 ? <p className={`mt-2 ${muted}`}>Nessun amico ancora: cercali qui sotto.</p> : (
          <ul className="mt-2 divide-y">
            {friends.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center justify-between gap-4 py-2"><span>{person(r)}</span>
                {answer(r, "remove", "Rimuovi", `Rimuovere ${r.name} dagli amici?`)}</li>))}
          </ul>)}
        <p className={`mt-2 ${muted}`}>Gli amici sono i giocatori che puoi iscrivere ai tuoi <Link href="/amichevole/nuovo" className="underline">tornei amichevoli</Link>.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Cerca giocatori</h2>
        <form className="mt-2 flex gap-2">
          <input name="cerca" defaultValue={q} placeholder="Nome o cognome" minLength={2} className="min-w-0 flex-1 rounded border bg-transparent px-3 py-2" aria-label="Cerca" />
          <button className="rounded border px-4 py-2">Cerca</button>
        </form>
        {q.length >= 2 && (results.length === 0
          ? <p className={`mt-2 ${muted}`}>Nessun giocatore registrato con questo nome.</p>
          : <ul className="mt-2 divide-y">
              {results.map((r) => {
                const rel = related.get(r.userId);
                return (
                  <li key={r.userId} className="flex flex-wrap items-center justify-between gap-4 py-2"><span>{person(r)}</span>
                    {rel?.status === "accepted" ? <span className={muted}>Già amici</span>
                      : rel?.mine ? <span className={muted}>Richiesta inviata</span>
                      : <ActionForm action={sendFriendRequest} submitLabel={rel ? "Accetta richiesta" : "Aggiungi agli amici"} primary={false}>
                          <input type="hidden" name="player_id" value={r.playerId} />
                        </ActionForm>}
                  </li>);
              })}
            </ul>)}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Richieste inviate</h2>
          <ul className="mt-2 divide-y">
            {outgoing.map((r) => <li key={r.userId} className="flex flex-wrap items-center gap-4 py-2">{person(r)}{answer(r, "remove", "Annulla")}</li>)}
          </ul>
        </section>)}
    </div>
  );
}
