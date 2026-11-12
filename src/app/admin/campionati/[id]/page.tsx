import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { listAdminUsers } from "@/lib/admins";
import { STATUS_LABEL } from "@/lib/labels";
import { addChampionshipAdmin, addMembers, recomputeAction, removeChampionshipAdmin, removeMember, renameChampionship } from "../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "./shared";

export const metadata = { title: "Campionato" };

export default async function ChampionshipPage({ params }: PageProps<"/admin/campionati/[id]">) {
  const { id } = await params;
  const { admin, supabase, championship: c } = await loadManagedChampionship(id);
  const [{ data: ranking }, { data: allPlayers }, { data: tournaments }, { data: admins }] = await Promise.all([
    supabase.from("championship_ranking").select("player_id, full_name, club, rating, games_played, position").eq("championship_id", id).order("position").order("full_name"),
    supabase.from("players").select("id, full_name, club, active").order("full_name"),
    supabase.from("tournaments").select("id, name, starts_on, status").eq("championship_id", id).order("starts_on", { ascending: false, nullsFirst: false }),
    supabase.from("championship_admins").select("user_id").eq("championship_id", id),
  ]);
  const members = new Set((ranking ?? []).map((r) => r.player_id as string));
  const others = (allPlayers ?? []).filter((p) => p.active && !members.has(p.id as string));
  const adminUsers = admin.role === "owner" ? await listAdminUsers() : [];
  const assigned = new Set((admins ?? []).map((a) => a.user_id as string));
  const hidden = <input type="hidden" name="championship_id" value={id} />;

  return (
    <main className="space-y-10">
      <ChampionshipHeader c={c} current="" />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tornei</h2>
          <Link href={`/admin/tornei/nuovo?campionato=${id}`} className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">Nuovo torneo</Link>
        </div>
        {(tournaments ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>Nessun torneo ancora.</p> : (
          <ul className="mt-2 divide-y">
            {tournaments!.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 py-2">
                <Link href={`/admin/tornei/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                <span className={muted}>{t.starts_on ? new Date(t.starts_on).toLocaleDateString("it-IT") : "senza data"} · {STATUS_LABEL[t.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Classifica ({c.settings.label.toLowerCase()})</h2>
        {(ranking ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>Aggiungi i giocatori del campionato qui sotto.</p> : (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-1">#</th><th>Giocatore</th><th className="text-right">{c.settings.label}</th><th className="text-right">Partite</th><th /></tr></thead>
            <tbody>
              {ranking!.map((r) => (
                <tr key={r.player_id} className="border-b last:border-0">
                  <td className="py-1.5">{r.position}</td>
                  <td>{r.full_name}{r.club && <span className={muted}> · {r.club}</span>}</td>
                  <td className="text-right font-mono">{r.rating}</td>
                  <td className="text-right">{r.games_played}</td>
                  <td className="text-right">
                    {r.games_played === 0 && (
                      <ActionForm action={removeMember} submitLabel="Togli" primary={false} inline confirmText={`Togliere ${r.full_name} dal campionato?`}>
                        {hidden}<input type="hidden" name="player_id" value={r.player_id} />
                      </ActionForm>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ActionForm action={recomputeAction} submitLabel="Ricalcola la classifica" primary={false} className="mt-3">{hidden}</ActionForm>
        <p className={`mt-1 ${muted}`}>La classifica si ricalcola da sola a ogni modifica; il pulsante serve solo per sicurezza.</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Aggiungi giocatori al campionato</h2>
        <ActionForm action={addMembers} submitLabel="Aggiungi" className="mt-3">
          {hidden}
          {others.length > 0 && (
            <fieldset>
              <legend className={muted}>Giocatori già in anagrafica:</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {others.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" name="player_id" value={p.id} /> {p.full_name}{p.club && <span className={muted}>· {p.club}</span>}
                  </label>))}
              </div>
            </fieldset>)}
          <p className={`mt-4 ${muted}`}>{others.length > 0 ? "Oppure crea un giocatore nuovo:" : "Crea un giocatore nuovo:"}</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <input name="new_name" placeholder="Nome e cognome" maxLength={80} className={input} aria-label="Nome e cognome" />
            <input name="new_club" placeholder="Circolo (facoltativo)" maxLength={80} className={input} aria-label="Circolo" />
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Nome del campionato</h2>
        <ActionForm action={renameChampionship} submitLabel="Salva nome" primary={false} className="mt-2 flex flex-wrap items-center gap-3">
          {hidden}<input name="name" defaultValue={c.name} required maxLength={100} className={`${input} sm:w-96`} aria-label="Nome" />
        </ActionForm>
      </section>

      {admin.role === "owner" && (
        <section>
          <h2 className="text-lg font-semibold">Chi gestisce il campionato</h2>
          <p className={`mt-1 ${muted}`}>Tu (proprietario) puoi gestire tutto. Qui scegli gli amministratori che possono gestire questo campionato.</p>
          <ul className="mt-2 space-y-1">
            {adminUsers.filter((u) => assigned.has(u.userId)).map((u) => (
              <li key={u.userId} className="flex items-center gap-3">{u.email}
                <ActionForm action={removeChampionshipAdmin} submitLabel="Togli" primary={false} inline confirmText={`Togliere ${u.email} da questo campionato?`}>
                  {hidden}<input type="hidden" name="user_id" value={u.userId} />
                </ActionForm>
              </li>))}
          </ul>
          {adminUsers.some((u) => !assigned.has(u.userId)) ? (
            <ActionForm action={addChampionshipAdmin} submitLabel="Aggiungi" primary={false} className="mt-3 flex flex-wrap items-center gap-3">
              {hidden}
              <select name="user_id" className={`select-arrow ${input}`} aria-label="Amministratore">
                {adminUsers.filter((u) => !assigned.has(u.userId)).map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
              </select>
            </ActionForm>
          ) : <p className={`mt-2 ${muted}`}>Per aggiungere qualcuno, prima crealo in <Link href="/admin/amministratori" className="underline">Amministratori</Link>.</p>}
        </section>
      )}
    </main>
  );
}
