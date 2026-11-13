import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sameNameMatch } from "@/lib/names";
import { ActionForm } from "@/components/action-form";
import { getAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { requestJoin } from "../../profilo/actions";

export const metadata = { title: "Partecipa a una lega" };
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

export default function JoinPage({ params, searchParams }: PageProps<"/partecipa/[slug]">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Suspense fallback={<p className={muted}>Caricamento…</p>}><Join params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function Join({ params, searchParams }: Pick<PageProps<"/partecipa/[slug]">, "params" | "searchParams">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const token = typeof sp.invito === "string" ? sp.invito.slice(0, 64) : "";
  const svc = createServiceClient();
  const { data: c } = await svc.from("championships").select("id, name, kind").eq("slug", slug).maybeSingle();
  if (!c) notFound();
  const { data: inv } = await svc.from("championship_invites").select("token").eq("championship_id", c.id).maybeSingle();
  const validInvite = Boolean(token && inv?.token === token);
  const here = `/partecipa/${slug}${token ? `?invito=${encodeURIComponent(token)}` : ""}`;
  const account = await getAccount();

  const header = (
    <>
      <Link href={`/c/${slug}`} className={`${muted} hover:underline`}>← {c.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">Partecipa a «{c.name}»</h1>
      {token && !validInvite && <p className="mt-2 text-amber-700 dark:text-amber-400">Questo link d&apos;invito non è più valido. Puoi comunque inviare una richiesta, che un amministratore approverà.</p>}
      {validInvite && <p className="mt-2">Sei stato invitato: entri subito, senza attendere l&apos;approvazione.</p>}
    </>
  );
  if (!account) {
    return <>{header}
      <p className="mt-6">Per partecipare serve un account.</p>
      <div className="mt-3 flex gap-3">
        <Link href={`/registrati?next=${encodeURIComponent(here)}`} className="btn-primary">Registrati</Link>
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="rounded border px-4 py-2">Ho già un account</Link>
      </div></>;
  }
  const [{ data: member }, { data: pending }, { data: unclaimed }] = await Promise.all([
    svc.from("championship_players").select("player_id").eq("championship_id", c.id).eq("player_id", account.player.id).maybeSingle(),
    svc.from("championship_requests").select("id").eq("championship_id", c.id).eq("user_id", account.userId).eq("status", "pending").maybeSingle(),
    svc.from("championship_players").select("player_id, players!inner(full_name, user_id)").eq("championship_id", c.id).is("players.user_id", null),
  ]);
  if (member) return <>{header}<p className="mt-6">Fai già parte della lega. <Link href={`/c/${slug}`} className="underline">Vai alla classifica</Link></p></>;
  if (pending) return <>{header}<p className="mt-6">La tua richiesta è in attesa di approvazione. <Link href="/profilo" className="underline">Il mio profilo</Link></p></>;
  const names = (unclaimed ?? []).map((u) => ({ id: u.player_id as string, name: (u.players as unknown as { full_name: string }).full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  // Stesso nome di un giocatore già in classifica senza account: chiediamo esplicitamente se è lui.
  const match = sameNameMatch(account.player.full_name, names);
  const others = names.filter((n) => n.id !== match?.id);
  return <>{header}
    <ActionForm action={requestJoin} submitLabel={validInvite ? "Entra nella lega" : "Invia la richiesta"} className="mt-6 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {validInvite && <input type="hidden" name="invito" value={token} />}
      <p>Entri come <strong>{account.player.full_name}</strong>.</p>
      {match ? (
        <fieldset className="rounded-lg border-2 border-gold p-4">
          <input type="hidden" name="seen_match" value={match.id} />
          <legend className="px-1 font-semibold">In classifica c&apos;è già «{match.name}»: sei tu?</legend>
          <label className="mt-1 flex items-start gap-2"><input type="radio" name="claim_player_id" value={match.id} required className="mt-1" />
            <span>Sì, sono io<span className={`block ${muted}`}>Un amministratore controlla e collega il tuo account a quella posizione, con punti e storico.</span></span></label>
          <label className="mt-2 flex items-start gap-2"><input type="radio" name="claim_player_id" value="" required className="mt-1" />
            <span>No, è un&apos;altra persona{validInvite ? <span className={`block ${muted}`}>Entri subito come nuovo giocatore.</span> : null}</span></label>
          {others.length > 0 && <p className={`mt-2 ${muted}`}>Sei un altro giocatore già in classifica? Scegli «No» e scrivilo all&apos;amministratore della lega.</p>}
        </fieldset>
      ) : names.length > 0 && (
        <label className="grid gap-1">Sei già in classifica (per esempio dai tornei passati)?
          <select name="claim_player_id" defaultValue="" className="select-arrow rounded border bg-transparent py-2 pl-3">
            <option value="">No, sono nuovo</option>
            {names.map((n) => <option key={n.id} value={n.id}>Sì, sono {n.name}</option>)}
          </select>
          <span className={muted}>Se scegli un nome, un amministratore controlla e collega il tuo account a quella posizione in classifica.</span>
        </label>)}
    </ActionForm>
  </>;
}
