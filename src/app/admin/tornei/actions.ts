"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
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
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("Il nome del torneo è obbligatorio (2-100 caratteri).");
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) errors.push("Data non valida.");
  let rawFormat: unknown = null;
  try { rawFormat = JSON.parse(String(formData.get("format") ?? "")); } catch { /* gestito sotto */ }
  const parsed = parseFormat(rawFormat);
  if ("errors" in parsed) errors.push(...parsed.errors);
  if (errors.length || "errors" in parsed) return { errors };
  const format = parsed.format;

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
      format,
      group_count: format.groupCount,
      best_of: format.defaultKnockoutBestOf,
      created_by: admin.userId,
    }).select("id").single();
    if (!error) {
      revalidatePath("/admin/tornei");
      // Il codice in chiaro esce SOLO in questa risposta: non è salvato da nessuna parte.
      return { created: { id: data.id, name, publicCode, organizerCode: formatOrganizerCode(organizerCode) } };
    }
    if (error.code !== "23505") return { errors: ["Non sono riuscito a creare il torneo."] };
  }
  return { errors: ["Non sono riuscito a generare un codice unico, riprova."] };
}

export type EnrollState = { error?: string; ok?: string };

/** Imposta l'elenco degli iscritti (solo finché il torneo è in preparazione). */
export async function setEnrollment(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const wanted = new Set(formData.getAll("player_id").map(String));
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "draft") return { error: "I gironi sono già stati generati: le iscrizioni sono chiuse." };

  const { data: current } = await supabase.from("tournament_players").select("player_id").eq("tournament_id", tournamentId);
  const have = new Set((current ?? []).map((r) => r.player_id as string));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.has(id));
  if (toRemove.length) {
    const { error } = await supabase.from("tournament_players").delete()
      .eq("tournament_id", tournamentId).in("player_id", toRemove);
    if (error) return { error: "Non sono riuscito ad aggiornare le iscrizioni." };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("tournament_players")
      .insert(toAdd.map((player_id) => ({ tournament_id: tournamentId, player_id })));
    if (error) return { error: "Non sono riuscito ad aggiornare le iscrizioni." };
  }
  revalidatePath(`/admin/tornei/${tournamentId}`);
  return { ok: `Iscritti: ${wanted.size}.` };
}

export type RegenState = { error?: string; organizerCode?: string };

/** Genera un nuovo codice organizzatore: quello vecchio smette subito di funzionare. */
export async function regenerateOrganizerCode(_prev: RegenState, formData: FormData): Promise<RegenState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournament_id") ?? "");
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
  await requireAdmin();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status, format").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "draft") return { error: "I gironi sono già stati generati." };
  const parsed = parseFormat(t.format);
  if ("errors" in parsed) return { error: parsed.errors.join(" ") };

  const { data: tp } = await supabase.from("tournament_players")
    .select("player_id, players(rating)").eq("tournament_id", tournamentId);
  const players = (tp ?? []).map((r) => ({
    id: r.player_id as string,
    rating: (r.players as unknown as { rating: number } | null)?.rating ?? 1000,
  }));
  let plan;
  try { plan = buildTournament(players, parsed.format); } catch (e) { return { error: (e as Error).message }; }

  // "Prenota" il passaggio di stato: se due richieste arrivano insieme, solo una passa.
  const { data: claimed } = await supabase.from("tournaments").update({ status: "groups" })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (!claimed?.length) return { error: "I gironi sono già stati generati." };

  const rollback = async () => {
    await supabase.from("matches").delete().eq("tournament_id", tournamentId);
    await supabase.from("tournaments").update({ status: "draft" }).eq("id", tournamentId);
  };
  const { error: e1 } = await supabase.from("tournament_players").upsert(
    plan.assignments.map((a) => ({ tournament_id: tournamentId, player_id: a.playerId, seed: a.seed, group_no: a.group })),
    { onConflict: "tournament_id,player_id" });
  const { error: e2 } = e1 ? { error: e1 } : await supabase.from("matches").insert([
    ...plan.matches.map((m) => ({
      tournament_id: tournamentId, phase: "group", group_no: m.group, round: m.round, position: m.position,
      player_a: m.a, player_b: m.b, best_of: m.bestOf, set_points: m.set.points, golden_point: m.set.golden,
    })),
    ...plan.knockout.map((k) => ({
      tournament_id: tournamentId, phase: "knockout", stage: k.stage, round: 1, position: k.position,
      source_a: k.a, source_b: k.b, best_of: k.bestOf, set_points: k.set.points, golden_point: k.set.golden,
    })),
  ]);
  if (e2) { await rollback(); return { error: "Non sono riuscito a creare le partite. Nulla è stato modificato." }; }
  revalidatePath(`/admin/tornei/${tournamentId}`);
  return {};
}

/** Torna in preparazione cancellando gironi e partite, solo se nessun risultato è stato inserito. */
export async function resetGroups(_prev: GenState, formData: FormData): Promise<GenState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t || t.status === "draft" || t.status === "closed") return { error: "Operazione non disponibile." };
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId).not("sets_a", "is", null);
  if (count) return { error: `Ci sono già ${count} risultati inseriti: non posso annullare i gironi.` };
  const { error } = await supabase.from("matches").delete().eq("tournament_id", tournamentId);
  if (error) return { error: "Non sono riuscito ad annullare." };
  await supabase.from("tournament_players").update({ group_no: null, seed: null }).eq("tournament_id", tournamentId);
  await supabase.from("tournaments").update({ status: "draft" }).eq("id", tournamentId);
  revalidatePath(`/admin/tornei/${tournamentId}`);
  return {};
}

/** Correzione di un risultato da parte di un admin (prima della chiusura del torneo). */
export async function adminSubmitResult(_prev: ResultState, formData: FormData): Promise<ResultState> {
  await requireAdmin();
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: sets.error, set: sets.set };
  const r = await saveResult(tournamentId, String(formData.get("match_id") ?? ""), sets);
  if (r.ok) revalidatePath(`/admin/tornei/${tournamentId}/risultati`);
  return r;
}

export type CloseState = { error?: string; ok?: string };

export async function closeTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  await requireAdmin();
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const r = await closeTournament(tournamentId);
  if (r.ok) { await revokeOrganizerSessions(tournamentId); revalidatePath(`/admin/tornei/${tournamentId}`); revalidatePath("/"); }
  return r;
}

export async function reopenTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  await requireAdmin();
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const r = await reopenTournament(tournamentId);
  if (r.ok) { revalidatePath(`/admin/tornei/${tournamentId}`); revalidatePath("/"); }
  return r;
}
