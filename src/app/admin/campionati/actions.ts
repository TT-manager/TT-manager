"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireChampionshipManager, requireOwner } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { attachToChampionship } from "@/lib/account";
import { recomputeChampionship } from "@/lib/closing";
import { createServiceClient } from "@/lib/supabase/admin";
import { DEFAULT_RANKING, parseRankingSettings } from "@/lib/domain/ranking";
import { hasServiceKey } from "@/lib/organizer";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/components/action-form";
import { parseClubChoice } from "@/lib/clubs";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Aggiorna le pagine del campionato e ricalcola la classifica. */
async function done(cid: string, ok: string): Promise<ActionState> {
  revalidatePath(`/admin/campionati/${cid}`);
  if (hasServiceKey()) {
    const r = await recomputeChampionship(cid);
    if (r.error) { refresh(); return { error: `${ok} Classifica non ricalcolata: ${r.error}` }; }
  }
  refresh(); // aggiorna subito la pagina aperta
  return { ok };
}

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "campionato";
}

export async function createChampionship(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner();
  const name = str(formData, "name");
  const kind = str(formData, "kind") === "doubles" ? "doubles" : "singles";
  if (name.length < 2 || name.length > 100) return { error: "Il nome è obbligatorio (2-100 caratteri)." };
  const supabase = await createServerSupabase();
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase.from("championships")
      .insert({ name, slug, kind, settings: DEFAULT_RANKING, created_by: owner.userId }).select("id").single();
    if (!error) redirect(`/admin/campionati/${data.id}`);
    if (error.code !== "23505") return { error: "Non sono riuscito a creare il campionato." };
  }
  return { error: "Nome già usato da troppi campionati: scegline un altro." };
}

export async function setVisibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const isPublic = formData.get("is_public") === "on";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ is_public: isPublic }).eq("id", cid);
  if (error) return { error: "Non sono riuscito a salvare." };
  revalidatePath(`/admin/campionati/${cid}`); revalidatePath("/"); refresh();
  return { ok: isPublic ? "Ora il campionato è visibile a tutti nella home." : "Ora il campionato compare nella home solo a chi ne fa parte." };
}

export async function renameChampionship(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const name = str(formData, "name");
  if (name.length < 2 || name.length > 100) return { error: "Il nome è obbligatorio (2-100 caratteri)." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ name }).eq("id", cid);
  if (error) return { error: "Non sono riuscito a rinominare." };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: "Nome salvato." };
}

// ── Giocatori del campionato ──────────────────────────────────────────────
export async function addMembers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const ids = formData.getAll("player_id").map(String).filter((x) => UUID.test(x));
  const name = str(formData, "new_name");
  const club = parseClubChoice((k) => formData.get(k), false);
  const supabase = await createServerSupabase();
  if (name) {
    if (name.length < 2 || name.length > 80) return { error: "Il nome deve avere 2-80 caratteri." };
    if ("error" in club) return { error: club.error };
    const { data, error } = await supabase.from("players")
      .insert({ full_name: name, club_id: club.kind === "existing" ? club.clubId : null }).select("id").single();
    if (error) return { error: "Non sono riuscito a creare il giocatore." };
    ids.push(data.id as string);
  }
  if (ids.length === 0) return { error: "Scegli almeno un giocatore o scrivi il nome di uno nuovo." };
  const { error } = await supabase.from("championship_players")
    .upsert(ids.map((player_id) => ({ championship_id: cid, player_id })), { onConflict: "championship_id,player_id", ignoreDuplicates: true });
  if (error) return { error: "Non sono riuscito ad aggiungere i giocatori." };
  return done(cid, ids.length === 1 ? "Giocatore aggiunto." : `Aggiunti ${ids.length} giocatori.`);
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const pid = str(formData, "player_id");
  const supabase = await createServerSupabase();
  // Chi ha già giocato tornei del campionato resta: toglierlo cambierebbe la storia della classifica.
  const { count } = await supabase.from("entry_members").select("player_id, tournaments!inner(championship_id)", { count: "exact", head: true })
    .eq("player_id", pid).eq("tournaments.championship_id", cid);
  if (count) return { error: "Ha già giocato tornei di questo campionato: non si può togliere (puoi disattivarlo dalla pagina Giocatori)." };
  const { error } = await supabase.from("championship_players").delete().eq("championship_id", cid).eq("player_id", pid);
  if (error) return { error: "Non sono riuscito a togliere il giocatore." };
  return done(cid, "Giocatore tolto dal campionato.");
}

// ── Classifica di partenza ────────────────────────────────────────────────
export async function savePastTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const id = str(formData, "past_id");
  const name = str(formData, "name");
  const heldOn = str(formData, "held_on");
  if (name.length < 1 || name.length > 100) return { error: "Scrivi il nome del torneo." };
  if (heldOn && !DATE.test(heldOn)) return { error: "Data non valida." };
  const podium: { position: number; player_id: string }[] = [];
  for (const pos of [1, 2, 3, 4]) {
    const pid = str(formData, `pos${pos}`);
    if (!pid) continue;
    if (!UUID.test(pid)) return { error: "Giocatore non valido." };
    if (podium.some((p) => p.player_id === pid)) return { error: "Lo stesso giocatore compare in due posizioni." };
    podium.push({ position: pos, player_id: pid });
  }
  if (!podium.some((p) => p.position === 1)) return { error: "Indica almeno il vincitore." };
  const supabase = await createServerSupabase();
  let pastId = id;
  if (pastId) {
    const { error } = await supabase.from("past_tournaments").update({ name, held_on: heldOn || null }).eq("id", pastId).eq("championship_id", cid);
    if (error) return { error: "Non sono riuscito a salvare." };
    await supabase.from("past_results").delete().eq("past_tournament_id", pastId);
  } else {
    const { data, error } = await supabase.from("past_tournaments").insert({ championship_id: cid, name, held_on: heldOn || null }).select("id").single();
    if (error) return { error: "Non sono riuscito a salvare." };
    pastId = data.id as string;
  }
  const { error } = await supabase.from("past_results").insert(podium.map((p) => ({ ...p, past_tournament_id: pastId })));
  if (error) return { error: "Non sono riuscito a salvare il podio." };
  return done(cid, "Torneo passato salvato.");
}

export async function deletePastTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("past_tournaments").delete().eq("id", str(formData, "past_id")).eq("championship_id", cid);
  if (error) return { error: "Non sono riuscito a eliminare." };
  return done(cid, "Torneo passato eliminato.");
}

/** Correzioni manuali della classifica di partenza: campo start_<id> (vuoto = calcolata dai podi). */
export async function saveStartOverrides(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const supabase = await createServerSupabase();
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("start_")) continue;
    const pid = k.slice(6);
    if (!UUID.test(pid)) continue;
    const raw = String(v).trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 5000)) return { error: "I punti di partenza vanno da 0 a 5000." };
    const { error } = await supabase.from("championship_players").update({ start_override: value }).eq("championship_id", cid).eq("player_id", pid);
    if (error) return { error: "Non sono riuscito a salvare le correzioni." };
  }
  return done(cid, "Classifica di partenza salvata.");
}

// ── Assenze giustificate ──────────────────────────────────────────────────
export async function addAbsence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const pid = str(formData, "player_id"), from = str(formData, "from_date"), to = str(formData, "to_date"), note = str(formData, "note");
  if (!UUID.test(pid)) return { error: "Scegli il giocatore." };
  if (!DATE.test(from) || (to && !DATE.test(to))) return { error: "Date non valide." };
  if (to && to < from) return { error: "La fine non può essere prima dell'inizio." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("player_absences").insert({ championship_id: cid, player_id: pid, from_date: from, to_date: to || null, note: note.slice(0, 200) || null });
  if (error) return { error: "Non sono riuscito a salvare l'assenza." };
  return done(cid, "Assenza registrata.");
}

export async function deleteAbsence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("player_absences").delete().eq("id", Number(str(formData, "absence_id"))).eq("championship_id", cid);
  if (error) return { error: "Non sono riuscito a eliminare." };
  return done(cid, "Assenza eliminata.");
}

// ── Impostazioni del ranking ──────────────────────────────────────────────
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const n = (k: string) => (str(formData, k) === "" ? NaN : Number(str(formData, k)));
  const parsed = parseRankingSettings({
    label: str(formData, "label"),
    initial: n("initial"),
    k: { new: n("k_new"), mid: n("k_mid"), exp: n("k_exp") },
    newUntil: n("new_until"), midUntil: n("mid_until"),
    decay: { enabled: formData.get("decay_enabled") === "on", pct: n("decay_pct"), floor: n("decay_floor") },
    comeback: { enabled: formData.get("comeback_enabled") === "on", afterMissed: n("comeback_after"), matches: n("comeback_matches") },
    podium: { 1: n("podium1"), 2: n("podium2"), 3: n("podium3"), 4: n("podium4") },
  });
  if ("errors" in parsed) return { error: parsed.errors.join(" ") };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ settings: parsed.settings }).eq("id", cid);
  if (error) return { error: "Non sono riuscito a salvare le impostazioni." };
  return done(cid, "Impostazioni salvate e classifica ricalcolata.");
}

export async function recomputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  return done(cid, "Classifica ricalcolata.");
}

// ── Admin del campionato (solo proprietario) ──────────────────────────────
export async function addChampionshipAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const cid = str(formData, "championship_id"), uid = str(formData, "user_id");
  if (!UUID.test(cid) || !UUID.test(uid)) return { error: "Scegli un amministratore." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championship_admins").insert({ championship_id: cid, user_id: uid });
  if (error?.code === "23505") return { error: "Gestisce già questo campionato." };
  if (error) return { error: "Non sono riuscito ad aggiungerlo." };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: "Amministratore aggiunto al campionato." };
}

export async function removeChampionshipAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const cid = str(formData, "championship_id");
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championship_admins").delete().eq("championship_id", cid).eq("user_id", str(formData, "user_id"));
  if (error) return { error: "Non sono riuscito a toglierlo." };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: "Tolto dal campionato." };
}


// ── Richieste di partecipazione e link d'invito ───────────────────────────
export async function decideRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  if (!hasServiceKey()) return { error: "Chiave segreta non configurata." };
  const svc = createServiceClient();
  const { data: req } = await svc.from("championship_requests").select("id, user_id, status")
    .eq("id", Number(str(formData, "request_id"))).eq("championship_id", cid).maybeSingle();
  if (!req || req.status !== "pending") return { error: "Richiesta non più in attesa." };
  const decided = { decided_at: new Date().toISOString() };
  if (str(formData, "decision") === "reject") {
    await svc.from("championship_requests").update({ status: "rejected", ...decided }).eq("id", req.id);
    revalidatePath(`/admin/campionati/${cid}`); refresh();
    return { ok: "Richiesta rifiutata." };
  }
  const link = str(formData, "link_player_id");
  if (link && !UUID.test(link)) return { error: "Scelta non valida." };
  if (link) {
    const { data: m } = await svc.from("championship_players").select("player_id").eq("championship_id", cid).eq("player_id", link).maybeSingle();
    if (!m) return { error: "Quel giocatore non è nel campionato." };
  }
  const r = await attachToChampionship(cid, req.user_id as string, link || null);
  if (r.error) return { error: r.error };
  await svc.from("championship_requests").update({ status: "approved", ...decided }).eq("id", req.id);
  return done(cid, "Richiesta approvata.");
}

export async function regenerateInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  if (!hasServiceKey()) return { error: "Chiave segreta non configurata." };
  const token = randomBytes(18).toString("base64url");
  const { error } = await createServiceClient().from("championship_invites")
    .upsert({ championship_id: cid, token, created_at: new Date().toISOString() }, { onConflict: "championship_id" });
  if (error) return { error: "Non sono riuscito a creare il link." };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: "Nuovo link creato: quello vecchio non funziona più." };
}

export async function disableInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  if (!hasServiceKey()) return { error: "Chiave segreta non configurata." };
  await createServiceClient().from("championship_invites").delete().eq("championship_id", cid);
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: "Link disattivato." };
}
