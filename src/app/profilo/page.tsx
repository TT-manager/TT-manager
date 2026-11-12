import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { logout } from "../login/actions";
import { cancelRequest, updateProfile } from "./actions";

export const metadata = { title: "Il mio profilo" };
const input = "rounded border bg-transparent px-3 py-2";
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className={`${muted} hover:underline`}>← Classifiche</Link>
      <Suspense fallback={<p className={`mt-6 ${muted}`}>Caricamento…</p>}><Profile /></Suspense>
    </main>
  );
}

async function Profile() {
  const account = await requireAccount("/profilo");
  const svc = createServiceClient();
  const [{ data: memberships }, { data: requests }, { data: all }] = await Promise.all([
    svc.from("championship_players").select("rating, games_played, championships(id, name, slug)").eq("player_id", account.player.id),
    svc.from("championship_requests").select("id, status, created_at, championships(name, slug)").eq("user_id", account.userId)
      .neq("status", "approved").order("created_at", { ascending: false }).limit(20),
    svc.from("championships").select("id, name, slug, kind").order("name"),
  ]);
  type C = { id: string; name: string; slug: string };
  const mine = (memberships ?? []).map((m) => ({ ...(m.championships as unknown as C), rating: m.rating as number, games: m.games_played as number }));
  const mineIds = new Set(mine.map((m) => m.id));
  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const pendingSlugs = new Set(pending.map((r) => (r.championships as unknown as C).slug));
  const others = (all ?? []).filter((c) => !mineIds.has(c.id) && !pendingSlugs.has(c.slug));
  return (
    <div className="space-y-10">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{account.player.full_name}</h1>
        <div className="flex items-center gap-3 text-sm">
          {account.isAdmin && <Link href="/admin" className="underline">Amministrazione</Link>}
          <Link href={`/giocatore/${account.player.id}`} className="underline">La mia scheda pubblica</Link>
          <form action={logout}><button className="rounded border px-3 py-1">Esci</button></form>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold">I miei campionati</h2>
        {mine.length === 0 ? <p className={`mt-2 ${muted}`}>Non partecipi ancora a nessun campionato.</p> : (
          <ul className="mt-2 divide-y">
            {mine.map((m) => (
              <li key={m.id} className="flex justify-between py-2">
                <Link href={`/c/${m.slug}`} className="font-medium hover:underline">{m.name}</Link>
                <span className="tabular-nums">{m.rating} · {m.games} partite</span>
              </li>))}
          </ul>)}
        {pending.length > 0 && (
          <>
            <h3 className="mt-4 font-medium">Richieste in attesa</h3>
            <ul className="mt-1 space-y-1">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center gap-3">{(r.championships as unknown as C).name}
                  <ActionForm action={cancelRequest} submitLabel="Annulla" primary={false} inline>
                    <input type="hidden" name="request_id" value={r.id} />
                  </ActionForm>
                </li>))}
            </ul>
          </>)}
        {(requests ?? []).some((r) => r.status === "rejected") && (
          <p className={`mt-2 ${muted}`}>Richieste non accettate: {(requests ?? []).filter((r) => r.status === "rejected").map((r) => (r.championships as unknown as C).name).join(", ")}.</p>)}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Altri campionati</h2>
          <ul className="mt-2 divide-y">
            {others.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{c.name} <span className={muted}>· {c.kind === "doubles" ? "doppio" : "singolare"}</span></span>
                <Link href={`/partecipa/${c.slug}`} className="rounded border px-3 py-1 text-sm">Chiedi di partecipare</Link>
              </li>))}
          </ul>
        </section>)}

      <section>
        <h2 className="text-xl font-semibold">I miei dati</h2>
        <ActionForm action={updateProfile} submitLabel="Salva" className="mt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="full_name" defaultValue={account.player.full_name} required maxLength={80} className={input} aria-label="Nome e cognome" />
            <input name="club" defaultValue={account.player.club ?? ""} maxLength={80} placeholder="Circolo (facoltativo)" className={input} aria-label="Circolo" />
          </div>
        </ActionForm>
        <p className={`mt-2 ${muted}`}>Email: {account.email} · <Link href="/nuova-password" className="underline">Cambia password</Link></p>
      </section>
    </div>
  );
}
