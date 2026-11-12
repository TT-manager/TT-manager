import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentManager } from "@/lib/auth";
import { loadEntries } from "@/lib/entries";
import { STATUS_LABEL } from "@/lib/labels";
import { createServerSupabase } from "@/lib/supabase/server";
import { describeFormat, parseFormat } from "@/lib/domain/format";
import { closingSummary } from "@/lib/closing";
import { hasServiceKey } from "@/lib/organizer";
import { friendlyCandidates } from "@/lib/friends";
import { ActionForm } from "@/components/action-form";
import { formatDeadline, isoToRomeLocal, registrationIsOpen } from "@/lib/registration";
import { setRegistration } from "@/app/gestione/actions";
import { ClosingControl, EnrollmentForm, GroupsControl, GuestForm, PairsForm, RegenerateCode } from "./tournament-forms";

export const metadata = { title: "Torneo" };

export default async function TournamentAdminPage({ params }: PageProps<"/gestione/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const access = await requireTournamentManager(id);
  const { championshipId } = access;
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments")
    .select("id, name, starts_on, status, public_code, format, registration_open, registration_deadline").eq("id", id).maybeSingle();
  if (!t) notFound();
  // Torneo di campionato: si iscrivono i giocatori del campionato, con i loro punti.
  // Amichevole di un utente: lui, i suoi amici e i suoi ospiti.
  const [players, entries, championship] = await Promise.all([
    championshipId
      ? supabase.from("championship_ranking").select("player_id, full_name, club, rating").eq("championship_id", championshipId).order("full_name")
          .then(({ data }) => (data ?? []).map((r) => ({ id: r.player_id as string, full_name: r.full_name as string, club: r.club as string | null, rating: r.rating as number })))
      : access.ownerUserId && hasServiceKey() ? friendlyCandidates(access.ownerUserId) : Promise.resolve([]),
    loadEntries(supabase, id),
    championshipId ? supabase.from("championships").select("name").eq("id", championshipId).maybeSingle().then(({ data }) => data) : Promise.resolve(null),
  ]);
  const doubles = access.kind === "doubles";
  const friendly = !access.ranked;
  const userFriendly = !championshipId;
  const enrolledIds = entries.flatMap((e) => e.players.map((p) => p.id));
  const pairs = entries.map((e) => e.players.map((p) => p.id));
  const parsed = parseFormat(t.format);
  const mode = "format" in parsed ? parsed.format.mode ?? "groups" : "groups";
  const knockoutOnly = mode === "knockout";
  const summary = t.status !== "draft" && hasServiceKey() ? await closingSummary(t.id) : null;

  return (
    <main className="space-y-8">
      <div>
        {championshipId
          ? <Link href={`/admin/campionati/${championshipId}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {championship?.name ?? "Campionato"}</Link>
          : <Link href="/profilo" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← Il mio profilo</Link>}
        <h1 className="mt-2 text-2xl font-bold">{t.name}
          {friendly && <span className="ml-3 rounded bg-sky-100 px-2 py-0.5 align-middle text-sm font-normal text-sky-900 dark:bg-sky-900 dark:text-sky-100">Amichevole</span>}</h1>
        {friendly && <p className="text-sm text-neutral-600 dark:text-neutral-400">Non conta per nessuna classifica.</p>}
        <p className="text-neutral-600 dark:text-neutral-400">
          {t.starts_on ? new Date(t.starts_on).toLocaleDateString("it-IT") : "Senza data"} · {STATUS_LABEL[t.status]}
        </p>
        <p className="mt-2">Codice pubblico: <span className="font-mono text-lg">{t.public_code}</span>{" "}
          <span className="text-sm text-neutral-600 dark:text-neutral-400">(pagina pubblica: /t/{t.public_code})</span></p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Formato</h2>
        {t.format === null
          ? <p className="mt-2">Formato non ancora impostato. Puoi farlo anche dopo le iscrizioni, quando sai quanti siete.</p>
          : "format" in parsed
            ? <ul className="mt-2 list-disc pl-5">{describeFormat(parsed.format, entries.length || undefined).map((l) => <li key={l}>{l}</li>)}</ul>
            : <p className="mt-2 text-red-700 dark:text-red-400">Formato non valido: correggilo.</p>}
        {t.status === "draft" && (
          <Link href={`/gestione/${t.id}/formato`} className="mt-3 inline-block rounded border px-4 py-2">
            {t.format === null ? "Imposta il formato" : "Modifica il formato"}</Link>
        )}
      </section>

      {championshipId && t.status === "draft" && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Iscrizioni dei giocatori</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {registrationIsOpen({ ...t, championship_id: championshipId })
              ? <>Aperte{t.registration_deadline ? ` fino a ${formatDeadline(t.registration_deadline)}` : ""}: i giocatori del campionato si iscrivono dalla <a href={`/t/${t.public_code}`} className="underline">pagina pubblica del torneo</a>{doubles ? " (scegliendo il compagno, oppure da soli)" : ""}.</>
              : t.registration_open ? "Scadenza superata: nessuno può più iscriversi da solo." : "Chiuse: solo tu puoi iscrivere i giocatori."}
            {" "}Si chiudono comunque quando generi {knockoutOnly ? "il tabellone" : mode === "league" ? "il calendario" : "i gironi"}.</p>
          <ActionForm action={setRegistration} submitLabel="Salva" primary={false} className="mt-3 flex flex-wrap items-end gap-4">
            <input type="hidden" name="tournament_id" value={t.id} />
            <label className="flex items-center gap-2"><input type="checkbox" name="open" defaultChecked={t.registration_open} /> Iscrizioni aperte</label>
            <label className="grid gap-1 text-sm">Chiusura (facoltativa)
              <input type="datetime-local" name="deadline" defaultValue={t.registration_deadline ? isoToRomeLocal(t.registration_deadline) : ""}
                className="rounded border bg-transparent px-3 py-1.5" /></label>
          </ActionForm>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Ricarica la pagina per vedere chi si è iscritto nel frattempo.</p>
        </section>)}

      <section>
        <h2 className="text-lg font-semibold">{doubles ? `Coppie iscritte (${entries.length})` : `Iscritti (${entries.length})`}</h2>
        {doubles
          ? <PairsForm tournamentId={t.id} players={players} initialPairs={pairs} locked={t.status !== "draft"} closed={t.status === "closed"} />
          : <EnrollmentForm tournamentId={t.id} players={players} enrolledIds={enrolledIds} locked={t.status !== "draft"} closed={t.status === "closed"} />}
        {userFriendly && t.status === "draft" && (
          <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            <p>Puoi iscrivere te stesso e i tuoi <a href="/amici" className="underline">amici</a>. Per chi non ha un account aggiungi un ospite:</p>
            <GuestForm tournamentId={t.id} />
          </div>)}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{knockoutOnly ? "Tabellone" : mode === "league" ? "Calendario" : "Gironi"}</h2>
        {t.status !== "draft" && <p className="mt-2">{knockoutOnly ? "Tabellone generato." : mode === "league" ? "Calendario generato." : "Gironi generati."} <Link href={`/t/${t.public_code}`} className="underline">Apri la pagina pubblica</Link></p>}
        <GroupsControl tournamentId={t.id} status={t.status} mode={mode} hasFormat={t.format !== null} />
      </section>

      {t.status !== "draft" && (
        <section>
          <h2 className="text-lg font-semibold">Risultati</h2>
          <p className="mt-2"><Link href={`/gestione/${t.id}/risultati`} className="underline">Vedi e correggi tutti i risultati</Link></p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Chiusura</h2>
        <ClosingControl tournamentId={t.id} status={t.status} summary={summary} ranked={access.ranked} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Codice organizzatore</h2>
        <RegenerateCode tournamentId={t.id} />
      </section>
    </main>
  );
}
