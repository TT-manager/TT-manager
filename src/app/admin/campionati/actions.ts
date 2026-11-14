"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireChampionshipManager, requireOwner } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { attachToChampionship, mergeDuplicate } from "@/lib/account";
import { recomputeChampionship } from "@/lib/closing";
import { createServiceClient } from "@/lib/supabase/admin";
import { DEFAULT_RANKING, parseRankingSettings } from "@/lib/domain/ranking";
import { hasServiceKey } from "@/lib/organizer";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/components/action-form";
import type { ResultState } from "@/components/match-form";
import { adminDecideChallenge } from "@/lib/challenges";
import { setsFromForm } from "@/lib/domain/score";
import { parseClubChoice } from "@/lib/clubs";
import { getLocale, tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";
import { clubErrorText } from "@/i18n/dict/account-clubs";
import { translateDomainError } from "@/i18n/domain-errors";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Aggiorna le pagine della lega e ricalcola la classifica. */
async function done(cid: string, ok: string): Promise<ActionState> {
  revalidatePath(`/admin/campionati/${cid}`);
  if (hasServiceKey()) {
    const r = await recomputeChampionship(cid);
    if (r.error) { refresh(); return { error: (await tr(adminLeaguesText)).notRecomputed(ok, r.error) }; }
  }
  refresh(); // aggiorna subito la pagina aperta
  return { ok };
}

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "lega";
}

export async function createChampionship(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner();
  const t = await tr(adminLeaguesText);
  const name = str(formData, "name");
  const kind = str(formData, "kind") === "doubles" ? "doubles" : "singles";
  if (name.length < 2 || name.length > 100) return { error: t.nameRequired };
  const supabase = await createServerSupabase();
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase.from("championships")
      .insert({ name, slug, kind, settings: DEFAULT_RANKING, created_by: owner.userId }).select("id").single();
    if (!error) redirect(`/admin/campionati/${data.id}`);
    if (error.code !== "23505") return { error: t.cantCreateLeague };
  }
  return { error: t.nameTaken };
}

export async function setVisibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const isPublic = formData.get("is_public") === "on";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ is_public: isPublic }).eq("id", cid);
  if (error) return { error: t.cantSave };
  revalidatePath(`/admin/campionati/${cid}`); revalidatePath("/"); refresh();
  return { ok: isPublic ? t.nowPublic : t.nowPrivate };
}

export async function renameChampionship(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const name = str(formData, "name");
  if (name.length < 2 || name.length > 100) return { error: t.nameRequired };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ name }).eq("id", cid);
  if (error) return { error: t.cantRename };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: t.nameSaved };
}

// ── Giocatori della lega ──────────────────────────────────────────────
export async function addMembers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const ids = formData.getAll("player_id").map(String).filter((x) => UUID.test(x));
  const name = str(formData, "new_name");
  const club = parseClubChoice((k) => formData.get(k), false);
  const supabase = await createServerSupabase();
  if (name) {
    if (name.length < 2 || name.length > 80) return { error: t.nameLength };
    if ("error" in club) return { error: clubErrorText(club.error, await getLocale()) };
    const { data, error } = await supabase.from("players")
      .insert({ full_name: name, club_id: club.kind === "existing" ? club.clubId : null }).select("id").single();
    if (error) return { error: t.cantCreatePlayer };
    ids.push(data.id as string);
  }
  if (ids.length === 0) return { error: t.choosePlayers };
  const { error } = await supabase.from("championship_players")
    .upsert(ids.map((player_id) => ({ championship_id: cid, player_id })), { onConflict: "championship_id,player_id", ignoreDuplicates: true });
  if (error) return { error: t.cantAddPlayers };
  return done(cid, t.playersAdded(ids.length));
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const pid = str(formData, "player_id");
  const supabase = await createServerSupabase();
  // Chi ha già giocato tornei della lega resta: toglierlo cambierebbe la storia della classifica.
  const { count } = await supabase.from("entry_members").select("player_id, tournaments!inner(championship_id)", { count: "exact", head: true })
    .eq("player_id", pid).eq("tournaments.championship_id", cid);
  if (count) return { error: t.alreadyPlayed };
  const { error } = await supabase.from("championship_players").delete().eq("championship_id", cid).eq("player_id", pid);
  if (error) return { error: t.cantRemovePlayer };
  return done(cid, t.playerRemoved);
}

// ── Classifica di partenza ────────────────────────────────────────────────
export async function savePastTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const id = str(formData, "past_id");
  const name = str(formData, "name");
  const heldOn = str(formData, "held_on");
  if (name.length < 1 || name.length > 100) return { error: t.writeTournamentName };
  if (heldOn && !DATE.test(heldOn)) return { error: t.invalidDate };
  const podium: { position: number; player_id: string }[] = [];
  for (const pos of [1, 2, 3, 4]) {
    const pid = str(formData, `pos${pos}`);
    if (!pid) continue;
    if (!UUID.test(pid)) return { error: t.invalidPlayer };
    if (podium.some((p) => p.player_id === pid)) return { error: t.samePlayerTwice };
    podium.push({ position: pos, player_id: pid });
  }
  if (!podium.some((p) => p.position === 1)) return { error: t.winnerRequired };
  const supabase = await createServerSupabase();
  let pastId = id;
  if (pastId) {
    const { error } = await supabase.from("past_tournaments").update({ name, held_on: heldOn || null }).eq("id", pastId).eq("championship_id", cid);
    if (error) return { error: t.cantSave };
    await supabase.from("past_results").delete().eq("past_tournament_id", pastId);
  } else {
    const { data, error } = await supabase.from("past_tournaments").insert({ championship_id: cid, name, held_on: heldOn || null }).select("id").single();
    if (error) return { error: t.cantSave };
    pastId = data.id as string;
  }
  const { error } = await supabase.from("past_results").insert(podium.map((p) => ({ ...p, past_tournament_id: pastId })));
  if (error) return { error: t.cantSavePodium };
  return done(cid, t.pastSaved);
}

export async function deletePastTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("past_tournaments").delete().eq("id", str(formData, "past_id")).eq("championship_id", cid);
  if (error) return { error: t.cantDelete };
  return done(cid, t.pastDeleted);
}

/** Correzioni manuali della classifica di partenza: campo start_<id> (vuoto = calcolata dai podi). */
export async function saveStartOverrides(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const supabase = await createServerSupabase();
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("start_")) continue;
    const pid = k.slice(6);
    if (!UUID.test(pid)) continue;
    const raw = String(v).trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 5000)) return { error: t.startRange };
    const { error } = await supabase.from("championship_players").update({ start_override: value }).eq("championship_id", cid).eq("player_id", pid);
    if (error) return { error: t.cantSaveCorrections };
  }
  return done(cid, t.startSaved);
}

// ── Assenze giustificate ──────────────────────────────────────────────────
export async function addAbsence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const pid = str(formData, "player_id"), from = str(formData, "from_date"), to = str(formData, "to_date"), note = str(formData, "note");
  if (!UUID.test(pid)) return { error: t.choosePlayer };
  if (!DATE.test(from) || (to && !DATE.test(to))) return { error: t.invalidDates };
  if (to && to < from) return { error: t.endBeforeStart };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("player_absences").insert({ championship_id: cid, player_id: pid, from_date: from, to_date: to || null, note: note.slice(0, 200) || null });
  if (error) return { error: t.cantSaveAbsence };
  return done(cid, t.absenceRecorded);
}

export async function deleteAbsence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("player_absences").delete().eq("id", Number(str(formData, "absence_id"))).eq("championship_id", cid);
  if (error) return { error: t.cantDelete };
  return done(cid, t.absenceDeleted);
}

// ── Impostazioni del ranking ──────────────────────────────────────────────
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  const n = (k: string) => (str(formData, k) === "" ? NaN : Number(str(formData, k)));
  const parsed = parseRankingSettings({
    label: str(formData, "label"),
    initial: n("initial"),
    k: { new: n("k_new"), mid: n("k_mid"), exp: n("k_exp") },
    newUntil: n("new_until"), midUntil: n("mid_until"),
    decay: { enabled: formData.get("decay_enabled") === "on", pct: n("decay_pct"), floor: n("decay_floor") },
    comeback: { enabled: formData.get("comeback_enabled") === "on", afterMissed: n("comeback_after"), matches: n("comeback_matches") },
    podium: { 1: n("podium1"), 2: n("podium2"), 3: n("podium3"), 4: n("podium4") },
    // Nelle leghe di doppio la sezione delle sfide non c'è: restano spente.
    challenges: formData.has("challenges_weight")
      ? { enabled: formData.get("challenges_enabled") === "on", weight: n("challenges_weight"), perWeek: n("challenges_per_week") }
      : undefined,
  });
  if ("errors" in parsed) { const l = await getLocale(); return { error: parsed.errors.map((e) => translateDomainError(e, l)).join(" ") }; }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championships").update({ settings: parsed.settings }).eq("id", cid);
  if (error) return { error: t.cantSaveSettings };
  return done(cid, t.settingsSaved);
}

export async function recomputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  return done(cid, t.recomputed);
}

// ── Admin della lega (solo proprietario) ──────────────────────────────
export async function addChampionshipAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminLeaguesText);
  const cid = str(formData, "championship_id"), uid = str(formData, "user_id");
  if (!UUID.test(cid) || !UUID.test(uid)) return { error: t.chooseAdmin };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championship_admins").insert({ championship_id: cid, user_id: uid });
  if (error?.code === "23505") return { error: t.alreadyManages };
  if (error) return { error: t.cantAddHim };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: t.adminAdded };
}

export async function removeChampionshipAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminLeaguesText);
  const cid = str(formData, "championship_id");
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("championship_admins").delete().eq("championship_id", cid).eq("user_id", str(formData, "user_id"));
  if (error) return { error: t.cantRemoveHim };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: t.removedFromLeague };
}


// ── Richieste di partecipazione e link d'invito ───────────────────────────
export async function decideRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  if (!hasServiceKey()) return { error: t.serviceKeyNotSet };
  const svc = createServiceClient();
  const { data: req } = await svc.from("championship_requests").select("id, user_id, status")
    .eq("id", Number(str(formData, "request_id"))).eq("championship_id", cid).maybeSingle();
  if (!req || req.status !== "pending") return { error: t.requestNotPending };
  const decided = { decided_at: new Date().toISOString() };
  if (str(formData, "decision") === "reject") {
    await svc.from("championship_requests").update({ status: "rejected", ...decided }).eq("id", req.id);
    revalidatePath(`/admin/campionati/${cid}`); refresh();
    return { ok: t.requestRejected };
  }
  const link = str(formData, "link_player_id");
  if (link && !UUID.test(link)) return { error: t.invalidChoice };
  if (link) {
    const { data: m } = await svc.from("championship_players").select("player_id").eq("championship_id", cid).eq("player_id", link).maybeSingle();
    if (!m) return { error: t.playerNotInLeague };
  }
  const r = await attachToChampionship(cid, req.user_id as string, link || null);
  if (r.error) return { error: r.error };
  await svc.from("championship_requests").update({ status: "approved", ...decided }).eq("id", req.id);
  return done(cid, t.requestApproved);
}

export async function regenerateInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  if (!hasServiceKey()) return { error: t.serviceKeyNotSet };
  const token = randomBytes(18).toString("base64url");
  const { error } = await createServiceClient().from("championship_invites")
    .upsert({ championship_id: cid, token, created_at: new Date().toISOString() }, { onConflict: "championship_id" });
  if (error) return { error: t.cantCreateLink };
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: t.newLinkCreated };
}

export async function disableInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  if (!hasServiceKey()) return { error: t.serviceKeyNotSet };
  await createServiceClient().from("championship_invites").delete().eq("championship_id", cid);
  revalidatePath(`/admin/campionati/${cid}`); refresh();
  return { ok: t.linkDisabled };
}

/** Unisce un doppione: l'account registrato passa alla scheda creata dall'amministratore. */
export async function mergeDuplicateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const t = await tr(adminLeaguesText);
  if (!hasServiceKey()) return { error: t.missingServiceKey };
  const to = str(formData, "to_player_id"), from = str(formData, "from_player_id");
  if (!UUID.test(to) || !UUID.test(from)) return { error: t.chooseTwoRecords };
  const svc = createServiceClient();
  const { data: both } = await svc.from("championship_players").select("player_id").eq("championship_id", cid).in("player_id", [to, from]);
  if ((both ?? []).length !== 2) return { error: t.bothInLeague };
  const { data: leagues } = await svc.from("championship_players").select("championship_id").eq("player_id", from);
  const r = await mergeDuplicate(to, from);
  if (r.error) return r;
  // Classifiche ricalcolate dove c'era la scheda tolta (la sua riga di partenza sparisce).
  for (const l of leagues ?? []) if (l.championship_id !== cid) await recomputeChampionship(l.championship_id as string);
  return done(cid, r.ok!);
}

// ── Sfide contestate ──────────────────────────────────────────────────────
export async function decideChallengeAction(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const sets = setsFromForm(formData);
  if ("error" in sets) return { error: translateDomainError(sets.error, await getLocale()), set: sets.set };
  const r = await adminDecideChallenge(cid, str(formData, "match_id"), { sets });
  revalidatePath("/", "layout"); refresh();
  return r;
}

/** Conferma il risultato così com'è (decision=confirm) oppure annulla la sfida. */
export async function settleChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cid = str(formData, "championship_id");
  await requireChampionshipManager(cid);
  const r = await adminDecideChallenge(cid, str(formData, "challenge_id"), str(formData, "decision") === "confirm" ? "confirm" : "annul");
  revalidatePath("/", "layout"); refresh();
  return { error: r.error, ok: r.ok };
}
