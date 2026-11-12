import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentManager } from "@/lib/auth";
import { loadEntries } from "@/lib/entries";
import { STATUS_LABEL } from "@/lib/labels";
import { createServerSupabase } from "@/lib/supabase/server";
import { describeFormat, parseFormat } from "@/lib/domain/format";
import { closingSummary } from "@/lib/closing";
import { hasServiceKey } from "@/lib/organizer";
import { ClosingControl, EnrollmentForm, GroupsControl, PairsForm, RegenerateCode } from "./tournament-forms";

export const metadata = { title: "Torneo" };

export default async function TournamentAdminPage({ params }: PageProps<"/admin/tornei/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { championshipId } = await requireTournamentManager(id);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments")
    .select("id, name, starts_on, status, public_code, format").eq("id", id).maybeSingle();
  if (!t) notFound();
  // Si iscrivono i giocatori del campionato, con i loro punti nel campionato.
  const [{ data: ranking }, entries, { data: championship }] = await Promise.all([
    supabase.from("championship_ranking").select("player_id, full_name, club, rating").eq("championship_id", championshipId).order("full_name"),
    loadEntries(supabase, id),
    supabase.from("championships").select("name, kind").eq("id", championshipId).maybeSingle(),
  ]);
  const players = (ranking ?? []).map((r) => ({ id: r.player_id as string, full_name: r.full_name as string, club: r.club as string | null, rating: r.rating as number }));
  const doubles = championship?.kind === "doubles";
  const enrolledIds = entries.flatMap((e) => e.players.map((p) => p.id));
  const pairs = entries.map((e) => e.players.map((p) => p.id));
  const parsed = parseFormat(t.format);
  const mode = "format" in parsed ? parsed.format.mode ?? "groups" : "groups";
  const knockoutOnly = mode === "knockout";
  const summary = t.status !== "draft" && hasServiceKey() ? await closingSummary(t.id) : null;

  return (
    <main className="space-y-8">
      <div>
        <Link href={`/admin/campionati/${championshipId}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {championship?.name ?? "Campionato"}</Link>
        <h1 className="mt-2 text-2xl font-bold">{t.name}</h1>
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
          <Link href={`/admin/tornei/${t.id}/formato`} className="mt-3 inline-block rounded border px-4 py-2">
            {t.format === null ? "Imposta il formato" : "Modifica il formato"}</Link>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{doubles ? `Coppie iscritte (${entries.length})` : `Iscritti (${entries.length})`}</h2>
        {doubles
          ? <PairsForm tournamentId={t.id} players={players} initialPairs={pairs} locked={t.status !== "draft"} closed={t.status === "closed"} />
          : <EnrollmentForm tournamentId={t.id} players={players} enrolledIds={enrolledIds} locked={t.status !== "draft"} closed={t.status === "closed"} />}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{knockoutOnly ? "Tabellone" : mode === "league" ? "Calendario" : "Gironi"}</h2>
        {t.status !== "draft" && <p className="mt-2">{knockoutOnly ? "Tabellone generato." : mode === "league" ? "Calendario generato." : "Gironi generati."} <Link href={`/t/${t.public_code}`} className="underline">Apri la pagina pubblica</Link></p>}
        <GroupsControl tournamentId={t.id} status={t.status} mode={mode} hasFormat={t.format !== null} />
      </section>

      {t.status !== "draft" && (
        <section>
          <h2 className="text-lg font-semibold">Risultati</h2>
          <p className="mt-2"><Link href={`/admin/tornei/${t.id}/risultati`} className="underline">Vedi e correggi tutti i risultati</Link></p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Chiusura</h2>
        <ClosingControl tournamentId={t.id} status={t.status} summary={summary} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Codice organizzatore</h2>
        <RegenerateCode tournamentId={t.id} />
      </section>
    </main>
  );
}
