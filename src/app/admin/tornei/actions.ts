"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatOrganizerCode, hashCode, newOrganizerCode, newPublicCode } from "@/lib/codes";
import { parseFormat } from "@/lib/domain/format";

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
  return { organizerCode: formatOrganizerCode(code) };
}
