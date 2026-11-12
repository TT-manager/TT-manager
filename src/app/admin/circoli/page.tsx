import { ActionForm } from "@/components/action-form";
import { requireOwner } from "@/lib/auth";
import { clubLabel, type Club } from "@/lib/clubs";
import { createServiceClient } from "@/lib/supabase/admin";
import { timeAgo } from "@/lib/time";
import { addClub, decideClubRequest, deleteClub, updateClub } from "./actions";

export const metadata = { title: "Circoli" };
const input = "rounded border bg-transparent px-3 py-2";
const muted = "text-sm text-muted";

export default async function ClubsPage() {
  await requireOwner();
  const svc = createServiceClient();
  const [{ data: clubRows }, { data: requests }, { data: members }] = await Promise.all([
    svc.from("clubs").select("id, name, city").order("name"),
    svc.from("club_requests").select("id, user_id, name, city, created_at").eq("status", "pending").order("created_at"),
    svc.from("players").select("club_id").not("club_id", "is", null),
  ]);
  const clubs = (clubRows ?? []) as Club[];
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.club_id as string, (count.get(m.club_id as string) ?? 0) + 1);
  const userIds = (requests ?? []).map((r) => r.user_id as string);
  const { data: requesters } = userIds.length
    ? await svc.from("players").select("user_id, full_name").in("user_id", userIds) : { data: [] };
  const who = new Map((requesters ?? []).map((p) => [p.user_id as string, p.full_name as string]));

  return (
    <main className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Circoli</h1>
        <p className={`mt-1 ${muted}`}>I giocatori scelgono il circolo da questo elenco. Se il loro non c&apos;è, ti mandano una richiesta.</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Richieste in attesa{requests?.length ? ` (${requests.length})` : ""}</h2>
        {!requests?.length ? <p className={`mt-2 ${muted}`}>Nessuna richiesta.</p> : (
          <ul className="mt-2 space-y-4">
            {requests.map((r) => (
              <li key={r.id} className="card space-y-3">
                <p><strong>{who.get(r.user_id as string) ?? "Un utente"}</strong> chiede di aggiungere
                  {" "}<strong>{r.name}</strong>{r.city ? ` (${r.city})` : ""} <span className={muted}>· {timeAgo(r.created_at as string)}</span></p>
                <ActionForm action={decideClubRequest} submitLabel="Approva e crea il circolo">
                  <input type="hidden" name="request_id" value={r.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <p className={muted}>Puoi correggere nome e città prima di approvare.</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <input name="name" defaultValue={r.name} required maxLength={80} className={input} aria-label="Nome del circolo" />
                    <input name="city" defaultValue={r.city ?? ""} maxLength={60} placeholder="Città" className={input} aria-label="Città" />
                  </div>
                </ActionForm>
                {clubs.length > 0 && (
                  <ActionForm action={decideClubRequest} submitLabel="Assegna" primary={false}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="decision" value="assign" />
                    <label className={`block ${muted}`}>Oppure è uno già in elenco (scritto diversamente):
                      <select name="club_id" required defaultValue="" className={`${input} mt-1 block w-full`}>
                        <option value="" disabled>Scegli il circolo…</option>
                        {clubs.map((c) => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
                      </select>
                    </label>
                  </ActionForm>)}
                <ActionForm action={decideClubRequest} submitLabel="Rifiuta" primary={false} inline confirmText="Rifiutare la richiesta?">
                  <input type="hidden" name="request_id" value={r.id} />
                  <input type="hidden" name="decision" value="reject" />
                </ActionForm>
              </li>))}
          </ul>)}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Aggiungi un circolo</h2>
        <ActionForm action={addClub} submitLabel="Aggiungi" className="mt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="name" required maxLength={80} placeholder="Nome del circolo" className={input} aria-label="Nome del circolo" />
            <input name="city" maxLength={60} placeholder="Città (facoltativa)" className={input} aria-label="Città" />
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Elenco ({clubs.length})</h2>
        {!clubs.length ? <p className={`mt-2 ${muted}`}>Ancora nessun circolo.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {clubs.map((c) => {
              const n = count.get(c.id) ?? 0;
              return (
                <li key={c.id} className="py-3">
                  <ActionForm action={updateClub} submitLabel="Salva" primary={false}>
                    <input type="hidden" name="id" value={c.id} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input name="name" defaultValue={c.name} required maxLength={80} className={input} aria-label="Nome del circolo" />
                      <input name="city" defaultValue={c.city ?? ""} maxLength={60} placeholder="Città" className={input} aria-label="Città" />
                    </div>
                  </ActionForm>
                  <div className={`mt-1 flex flex-wrap items-center gap-3 ${muted}`}>
                    <span>{n === 1 ? "1 giocatore" : `${n} giocatori`}</span>
                    <ActionForm action={deleteClub} submitLabel="Elimina" primary={false} inline
                      confirmText={n ? `Eliminare ${c.name}? I suoi ${n} giocatori resteranno senza circolo.` : `Eliminare ${c.name}?`}>
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                  </div>
                </li>);
            })}
          </ul>)}
      </section>
    </main>
  );
}
