"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireChampionshipManager, requireTournamentManager } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatOrganizerCode, hashCode, newOrganizerCode, newPublicCode } from "@/lib/codes";
import { parseFormat } from "@/lib/domain/format";
import { buildTournament } from "@/lib/domain/tournament";
import { hasServiceKey, revokeOrganizerSessions } from "@/lib/organizer";
import { saveResult, setsFromForm } from "@/lib/results";
import { closeTournament, reopenTournament } from "@/lib/closing";
import type { ResultState } from "@/components/match-form";

export type CreateState = {
  errors?: string[];
  created?: { id: string; name: string; publicCode: string; organizerCode: string };
};

export async function createTournament(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const championshipId = String(formData.get("championship_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(championshipId)) return { errors: ["Scegli il campionato."] };
  const admin = await requireChampionshipManager(championshipId);
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("Il nome del torneo è obbligatorio (2-100 caratteri).");
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) errors.push("Data non valida.");
  if (errors.length) return { errors };

  const supabase = await createServerSupabase();
  const organizerCode = newOrganizerCode();
  const organizerHash = await hashCode(organizerCode);
  // Il codice pubblico è unico: in caso (rarissimo) di collisione si riprova.
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicCode = newPublicCode();
    const { data, error } = await supabase.from("tournaments").insert({
      name,
      starts_on: startsOn || null,
      public_code: publicCode,
      organizer_code_hash: organizerHash,
      championship_id: championshipId,
      created_by: admin.userId,
    }).select("id").single();
    if (!error) {
      revalidatePath("/admin/tornei");
      refresh(); // aggiorna subito la pagina aperta
      // Il codice in chiaro esce SOLO in questa risposta: non è salvato da nessuna parte.
      return { created: { id: data.id, name, publicCode, organizerCode: formatOrganizerCode(organizerCode) } };
    }
    if (error.code !== "23505") return { errors: ["Non sono riuscito a creare il torneo."] };
  }
  return { errors: ["Non sono riuscito a generare un codice unico, riprova."] };
}

export type FormatState = { errors?: string[]; ok?: string };

/** Imposta o modifica il formato: possibile finché il torneo è in preparazione. */
export async function updateFormat(_prev: FormatState, formData: FormData): Promise<FormatState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  let raw: unknown = null;
  try { raw = JSON.parse(String(formData.get("format") ?? "")); } catch { /* gestito sotto */ }
  const parsed = parseFormat(raw);
  if ("errors" in parsed) return { errors: parsed.errors };
  const f = parsed.format;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .update({ format: f, group_count: Math.max(f.groupCount, 1), best_of: f.defaultKnockoutBestOf })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (error) return { errors: ["Non sono riuscito a salvare il formato."] };
  if (!data?.length) return { errors: ["Il formato si può cambiare solo prima di generare gironi o tabellone."] };
  revalidatePath(`/admin/tornei/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: "Formato salvato." };
}

export type EnrollState = { error?: string; ok?: string };

/**
 * Imposta gli iscritti (solo finché il torneo è in preparazione).
 * Singolare: campi `player_id`. Doppio: campi `pair` con «id1,id2».
 * Si possono iscrivere solo giocatori del campionato; un giocatore una sola volta.
 */
export async function setEnrollment(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId } = await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const [{ data: t }, { data: ch }, { data: members }] = await Promise.all([
    supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle(),
    supabase.from("championships").select("kind").eq("id", championshipId).maybeSingle(),
    supabase.from("championship_players").select("player_id").eq("championship_id", championshipId),
  ]);
  if (!t || !ch) return { error: "Torneo non trovato." };
  if (t.status !== "draft") return { error: "Gironi, tabellone o calendario sono già stati generati: le iscrizioni sono chiuse." };
  const allowed = new Set((members ?? []).map((m) => m.player_id as string));

  const groups: string[][] = ch.kind === "doubles"
    ? formData.getAll("pair").map((v) => String(v).split(",").map((x) => x.trim()).filter(Boolean))
    : formData.getAll("player_id").map((v) => [String(v)]);
  const seen = new Set<string>();
  for (const g of groups) {
    if (ch.kind === "doubles" && g.length !== 2) return { error: "Ogni coppia deve avere due giocatori." };
    for (const id of g) {
      if (!allowed.has(id)) return { error: "Si possono iscrivere solo giocatori del campionato." };
      if (seen.has(id)) return { error: "Un giocatore compare in più di una coppia." };
      seen.add(id);
    }
  }
  // In preparazione non ci sono partite: si ricrea l'elenco da zero.
  const { error: delError } = await supabase.from("tournament_entries").delete().eq("tournament_id", tournamentId);
  if (delError) return { error: "Non sono riuscito ad aggiornare le iscrizioni." };
  if (groups.length) {
    const { data: created, error } = await supabase.from("tournament_entries")
      .insert(groups.map(() => ({ tournament_id: tournamentId }))).select("id");
    if (error || !created || created.length !== groups.length) return { error: "Non sono riuscito ad aggiornare le iscrizioni." };
    const { error: e2 } = await supabase.from("entry_members").insert(groups.flatMap((g, i) =>
      g.map((player_id) => ({ entry_id: created[i].id, tournament_id: tournamentId, player_id }))));
    if (e2) {
      await supabase.from("tournament_entries").delete().eq("tournament_id", tournamentId);
      return { error: "Non sono riuscito ad aggiornare le iscrizioni: riprova." };
    }
  }
  revalidatePath(`/admin/tornei/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: ch.kind === "doubles" ? `Coppie iscritte: ${groups.length}.` : `Iscritti: ${groups.length}.` };
}

export type RegenState = { error?: string; organizerCode?: string };

/** Genera un nuovo codice organizzatore: quello vecchio smette subito di funzionare. */
export async function regenerateOrganizerCode(_prev: RegenState, formData: FormData): Promise<RegenState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const code = newOrganizerCode();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .update({ organizer_code_hash: await hashCode(code) }).eq("id", tournamentId).select("id");
  if (error || !data?.length) return { error: "Non sono riuscito a generare il nuovo codice." };
  await revokeOrganizerSessions(tournamentId); // chi era entrato col vecchio codice deve rientrare
  return { organizerCode: formatOrganizerCode(code) };
}

export type GenState = { error?: string };

/** Compone i gironi, crea il calendario e lo scheletro del tabellone. Il torneo passa a "gironi in corso". */
export async function generateGroups(_prev: GenState, formData: FormData): Promise<GenState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId } = await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status, format").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "draft") return { error: "Gironi, tabellone o calendario sono già stati generati." };
  const parsed = parseFormat(t.format);
  if (t.format === null) return { error: "Imposta prima il formato del torneo." };
  if ("errors" in parsed) return { error: parsed.errors.join(" ") };
  const knockoutOnly = parsed.format.mode === "knockout";

  // Teste di serie dai punti del campionato (coppia = media dei due giocatori).
  const [{ data: members }, { data: ratings }] = await Promise.all([
    supabase.from("entry_members").select("entry_id, player_id").eq("tournament_id", tournamentId),
    supabase.from("championship_players").select("player_id, rating").eq("championship_id", championshipId),
  ]);
  const ratingOf = new Map((ratings ?? []).map((r) => [r.player_id as string, r.rating as number]));
  const byEntry = new Map<string, number[]>();
  for (const m of members ?? []) byEntry.set(m.entry_id as string, [...(byEntry.get(m.entry_id as string) ?? []), ratingOf.get(m.player_id as string) ?? 1000]);
  const players = [...byEntry].map(([id, rs]) => ({ id, rating: rs.reduce((a, b) => a + b, 0) / rs.length }));
  let plan;
  try { plan = buildTournament(players, parsed.format); } catch (e) { return { error: (e as Error).message }; }

  // "Prenota" il passaggio di stato: se due richieste arrivano insieme, solo una passa.
  const { data: claimed } = await supabase.from("tournaments").update({ status: knockoutOnly ? "knockout" : "groups" })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (!claimed?.length) return { error: "Gironi, tabellone o calendario sono già stati generati." };

  const rollback = async () => {
    await supabase.from("matches").delete().eq("tournament_id", tournamentId);
    await supabase.from("tournaments").update({ status: "draft" }).eq("id", tournamentId);
  };
  const { error: e1 } = await supabase.from("tournament_entries").upsert(
    plan.assignments.map((a) => ({ id: a.playerId, tournament_id: tournamentId, seed: a.seed, group_no: a.group })),
    { onConflict: "id" });
  const { error: e2 } = e1 ? { error: e1 } : await supabase.from("matches").insert([
    ...plan.matches.map((m) => ({
      tournament_id: tournamentId, phase: "group", group_no: m.group, round: m.round, position: m.position,
      player_a: m.a, player_b: m.b, best_of: m.bestOf, set_points: m.set.points, golden_point: m.set.golden,
    })),
    ...plan.knockout.map((k) => ({
      tournament_id: tournamentId, phase: "knockout", stage: k.stage, round: 1, position: k.position,
      source_a: k.a, source_b: k.b, player_a: k.playerA ?? null, player_b: k.playerB ?? null,
      best_of: k.bestOf, set_points: k.set.points, golden_point: k.set.golden,
    })),
  ]);
  if (e2) { await rollback(); return { error: "Non sono riuscito a creare le partite. Nulla è stato modificato." }; }
  revalidatePath(`/admin/tornei/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return {};
}

/** Torna in preparazione cancellando gironi e partite, solo se nessun risultato è stato inserito. */
export async function resetGroups(_prev: GenState, formData: FormData): Promise<GenState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t || t.status === "draft" || t.status === "closed") return { error: "Operazione non disponibile." };
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId).not("sets_a", "is", null);
  if (count) return { error: `Ci sono già ${count} risultati inseriti: non posso annullare i gironi.` };
  const { error } = await supabase.from("matches").delete().eq("tournament_id", tournamentId);
  if (error) return { error: "Non sono riuscito ad annullare." };
  await supabase.from("tournament_entries").update({ group_no: null, seed: null }).eq("tournament_id", tournamentId);
  await supabase.from("tournaments").update({ status: "draft" }).eq("id", tournamentId);
  revalidatePath(`/admin/tornei/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return {};
}

/** Correzione di un risultato da parte di un admin (prima della chiusura del torneo). */
export async function adminSubmitResult(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId); // prima della scrittura con la chiave segreta
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: sets.error, set: sets.set };
  const r = await saveResult(tournamentId, String(formData.get("match_id") ?? ""), sets);
  if (r.ok) { revalidatePath(`/admin/tornei/${tournamentId}/risultati`); refresh(); }
  return r;
}

export type CloseState = { error?: string; ok?: string };

export async function closeTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId } = await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const r = await closeTournament(championshipId, tournamentId);
  if (r.ok) { await revokeOrganizerSessions(tournamentId); revalidatePath(`/admin/tornei/${tournamentId}`); revalidatePath("/"); refresh(); }
  return r;
}

export async function reopenTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId } = await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const r = await reopenTournament(championshipId, tournamentId);
  if (r.ok) { revalidatePath(`/admin/tornei/${tournamentId}`); revalidatePath("/"); refresh(); }
  return r;
}
