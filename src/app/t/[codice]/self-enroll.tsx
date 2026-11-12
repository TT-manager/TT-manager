import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { getAccount } from "@/lib/account";
import { formatDeadline, registrationIsOpen } from "@/lib/registration";
import { createServiceClient } from "@/lib/supabase/admin";
import { selfEnroll, selfWithdraw } from "./iscrizione-actions";

type T = { id: string; public_code: string; status: string; kind: string; championship_id: string | null; registration_open: boolean; registration_deadline: string | null };

/** Riquadro «Iscriviti» per i giocatori del campionato (va dentro <Suspense>). */
export async function SelfEnroll({ t, slug }: { t: T; slug: string | null }) {
  if (!registrationIsOpen(t)) return null;
  const here = `/t/${t.public_code}`;
  const box = "mt-6 rounded-lg border-2 border-emerald-600 p-4";
  const deadline = t.registration_deadline && <p className="text-sm text-neutral-600 dark:text-neutral-400">Iscrizioni aperte fino a {formatDeadline(t.registration_deadline)}.</p>;
  const account = await getAccount();
  if (!account) return (
    <div className={box}><p className="font-semibold">Iscrizioni aperte</p>{deadline}
      <p className="mt-2"><Link href={`/login?next=${encodeURIComponent(here)}`} className="underline">Accedi</Link> per iscriverti.</p></div>);
  const svc = createServiceClient();
  const [{ data: member }, { data: mine }] = await Promise.all([
    svc.from("championship_players").select("player_id").eq("championship_id", t.championship_id).eq("player_id", account.player.id).maybeSingle(),
    svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", account.player.id).maybeSingle(),
  ]);
  if (!member) return (
    <div className={box}><p className="font-semibold">Iscrizioni aperte</p>{deadline}
      <p className="mt-2">Per iscriverti devi far parte del campionato. {slug && <Link href={`/partecipa/${slug}`} className="underline">Chiedi di partecipare</Link>}</p></div>);
  const hidden = <input type="hidden" name="public_code" value={t.public_code} />;
  if (mine) {
    const { data: mates } = await svc.from("entry_members").select("player_id, players(full_name)").eq("entry_id", mine.entry_id).neq("player_id", account.player.id);
    const mate = (mates?.[0]?.players as unknown as { full_name: string } | undefined)?.full_name;
    return (
      <div className={box}>
        <p className="font-semibold">Sei iscritto{t.kind === "doubles" ? (mate ? ` in coppia con ${mate}` : " da solo: l'organizzatore ti abbinerà a un compagno") : ""}.</p>{deadline}
        <ActionForm action={selfWithdraw} submitLabel="Ritirati" primary={false} confirmText="Vuoi ritirarti dal torneo?" className="mt-2">{hidden}</ActionForm>
      </div>);
  }
  let partners: { id: string; name: string; solo: boolean }[] = [];
  if (t.kind === "doubles") {
    const [{ data: all }, { data: enrolled }] = await Promise.all([
      svc.from("championship_players").select("player_id, players(full_name)").eq("championship_id", t.championship_id),
      svc.from("entry_members").select("entry_id, player_id").eq("tournament_id", t.id),
    ]);
    const size = new Map<string, number>();
    for (const e of enrolled ?? []) size.set(e.entry_id as string, (size.get(e.entry_id as string) ?? 0) + 1);
    const entryOf = new Map((enrolled ?? []).map((e) => [e.player_id as string, e.entry_id as string]));
    partners = (all ?? []).filter((p) => p.player_id !== account.player.id)
      .map((p) => ({ id: p.player_id as string, name: (p.players as unknown as { full_name: string } | null)?.full_name ?? "?",
        entry: entryOf.get(p.player_id as string) }))
      .filter((p) => !p.entry || size.get(p.entry) === 1)
      .map((p) => ({ id: p.id, name: p.name, solo: Boolean(p.entry) }))
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }
  return (
    <div className={box}>
      <p className="font-semibold">Iscrizioni aperte</p>{deadline}
      <ActionForm action={selfEnroll} submitLabel="Iscriviti" className="mt-2 space-y-2">
        {hidden}
        {t.kind === "doubles" && (
          <label className="grid gap-1">Compagno
            <select name="partner_id" defaultValue="" className="select-arrow rounded border bg-transparent py-2 pl-3 sm:w-96">
              <option value="">Non ho un compagno: abbinatemi voi</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.solo ? " (cerca un compagno)" : ""}</option>)}
            </select></label>)}
      </ActionForm>
    </div>);
}
