"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireChampionshipManager, requireTournamentManager } from "@/lib/auth";
import { requireAccount } from "@/lib/account";
import { bestRatings, friendlyCandidates } from "@/lib/friends";
import { createServiceClient } from "@/lib/supabase/admin";
import { romeToIso } from "@/lib/registration";
import { parseStreamUrl } from "@/lib/stream";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatOrganizerCode, hashCode, newOrganizerCode, newPublicCode } from "@/lib/codes";
import { parseFormat } from "@/lib/domain/format";
import { buildTournament } from "@/lib/domain/tournament";
import { hasServiceKey, revokeOrganizerSessions } from "@/lib/organizer";
import { confirmDisputed, disputedCount, saveResult, setsFromForm } from "@/lib/results";
import { closeTournament, reopenTournament } from "@/lib/closing";
import type { ResultState } from "@/components/match-form";
import { getLocale, tr } from "@/i18n/server";
import { adminManageText } from "@/i18n/dict/admin-manage";
import { translateDomainError } from "@/i18n/domain-errors";

export type CreateState = {
  errors?: string[];
  created?: { id: string; name: string; publicCode: string; organizerCode: string };
};

export async function createTournament(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const tx = await tr(adminManageText);
  const championshipId = String(formData.get("championship_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(championshipId)) return { errors: [tx.chooseLeague] };
  const admin = await requireChampionshipManager(championshipId);
  const ranked = formData.get("ranked") !== "friendly";
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push(tx.tournamentNameRequired);
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) errors.push(tx.invalidDate);
  if (errors.length) return { errors };

  const supabase = await createServerSupabase();
  const { data: ch } = await supabase.from("championships").select("kind").eq("id", championshipId).maybeSingle();
  if (!ch) return { errors: [tx.leagueNotFound] };
  return insertTournament(supabase, { name, starts_on: startsOn || null, championship_id: championshipId, ranked, kind: ch.kind, created_by: admin.userId });
}

/** Torneo amichevole creato da un utente: non conta per nessuna classifica. */
export async function createFriendlyTournament(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const tx = await tr(adminManageText);
  const account = await requireAccount("/amichevole/nuovo");
  const name = String(formData.get("name") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const kind = formData.get("kind") === "doubles" ? "doubles" : "singles";
  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push(tx.tournamentNameRequired);
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) errors.push(tx.invalidDate);
  if (errors.length) return { errors };
  const supabase = await createServerSupabase();
  const { count } = await supabase.from("tournaments").select("id", { count: "exact", head: true })
    .eq("owner_user_id", account.userId).neq("status", "closed");
  if ((count ?? 0) >= 10) return { errors: [tx.tooManyFriendlies] };
  return insertTournament(supabase, { name, starts_on: startsOn || null, championship_id: null, owner_user_id: account.userId, ranked: false, kind, created_by: account.userId });
}

async function insertTournament(supabase: Awaited<ReturnType<typeof createServerSupabase>>, row: Record<string, unknown>): Promise<CreateState> {
  const tx = await tr(adminManageText);
  const name = row.name as string;
  const organizerCode = newOrganizerCode();
  const organizerHash = await hashCode(organizerCode);
  // Il codice pubblico è unico: in caso (rarissimo) di collisione si riprova.
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicCode = newPublicCode();
    const { data, error } = await supabase.from("tournaments").insert({
      ...row, public_code: publicCode, organizer_code_hash: organizerHash,
    }).select("id").single();
    if (!error) {
      revalidatePath("/admin/tornei");
      refresh(); // aggiorna subito la pagina aperta
      // Il codice in chiaro esce SOLO in questa risposta: non è salvato da nessuna parte.
      return { created: { id: data.id, name, publicCode, organizerCode: formatOrganizerCode(organizerCode) } };
    }
    if (error.code !== "23505") return { errors: [tx.cantCreateTournament] };
  }
  return { errors: [tx.cantGenerateCode] };
}

export type FormatState = { errors?: string[]; ok?: string };

/** Imposta o modifica il formato: possibile finché il torneo è in preparazione. */
export async function updateFormat(_prev: FormatState, formData: FormData): Promise<FormatState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  let raw: unknown = null;
  try { raw = JSON.parse(String(formData.get("format") ?? "")); } catch { /* gestito sotto */ }
  const parsed = parseFormat(raw);
  if ("errors" in parsed) { const l = await getLocale(); return { errors: parsed.errors.map((e) => translateDomainError(e, l)) }; }
  const f = parsed.format;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .update({ format: f, group_count: Math.max(f.groupCount, 1), best_of: f.defaultKnockoutBestOf })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (error) return { errors: [tx.cantSaveFormat] };
  if (!data?.length) return { errors: [tx.formatOnlyDraft] };
  revalidatePath(`/gestione/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: tx.formatSaved };
}

export type EnrollState = { error?: string; ok?: string };

/**
 * Imposta gli iscritti (solo finché il torneo è in preparazione).
 * Singolare: campi `player_id`. Doppio: campi `pair` con «id1,id2».
 * Si possono iscrivere solo giocatori della lega; un giocatore una sola volta.
 */
export async function setEnrollment(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const access = await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: tx.tournamentNotFound };
  if (t.status !== "draft") return { error: tx.entriesClosedGenerated };
  const ch = { kind: access.kind };
  const allowed = new Set(await enrollablePlayerIds(access));

  let groups: string[][] = ch.kind === "doubles"
    ? formData.getAll("pair").map((v) => String(v).split(",").map((x) => x.trim()).filter(Boolean))
    : formData.getAll("player_id").map((v) => [String(v)]);
  if (ch.kind !== "doubles" && formData.get("diff") === "1") {
    // Applica solo le modifiche fatte dall'admin: chi si è iscritto da solo nel frattempo resta.
    const wanted = new Set(groups.map((g) => g[0]));
    const before = new Set(formData.getAll("before").map(String));
    const { data: now } = await supabase.from("entry_members").select("player_id").eq("tournament_id", tournamentId);
    const result = new Set((now ?? []).map((m) => m.player_id as string));
    for (const id of before) if (!wanted.has(id)) result.delete(id);
    for (const id of wanted) if (!before.has(id)) result.add(id);
    groups = [...result].map((id) => [id]);
  }
  const seen = new Set<string>();
  for (const g of groups) {
    if (ch.kind === "doubles" && (g.length < 1 || g.length > 2)) return { error: tx.pairNeedsTwo };
    for (const id of g) {
      if (!allowed.has(id)) return { error: access.championshipId ? tx.onlyLeaguePlayers : tx.onlyFriends };
      if (seen.has(id)) return { error: tx.playerTwice };
      seen.add(id);
    }
  }
  // In preparazione non ci sono partite: si ricrea l'elenco da zero.
  const { error: delError } = await supabase.from("tournament_entries").delete().eq("tournament_id", tournamentId);
  if (delError) return { error: tx.cantUpdateEntries };
  if (groups.length) {
    const { data: created, error } = await supabase.from("tournament_entries")
      .insert(groups.map(() => ({ tournament_id: tournamentId }))).select("id");
    if (error || !created || created.length !== groups.length) return { error: tx.cantUpdateEntries };
    const { error: e2 } = await supabase.from("entry_members").insert(groups.flatMap((g, i) =>
      g.map((player_id) => ({ entry_id: created[i].id, tournament_id: tournamentId, player_id }))));
    if (e2) {
      await supabase.from("tournament_entries").delete().eq("tournament_id", tournamentId);
      return { error: tx.cantUpdateEntriesRetry };
    }
  }
  revalidatePath(`/gestione/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: ch.kind === "doubles" ? tx.pairsSaved(groups.length) : tx.entriesSaved(groups.length) };
}

export type RegenState = { error?: string; organizerCode?: string };

/** Genera un nuovo codice organizzatore: quello vecchio smette subito di funzionare. */
export async function regenerateOrganizerCode(_prev: RegenState, formData: FormData): Promise<RegenState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const code = newOrganizerCode();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .update({ organizer_code_hash: await hashCode(code) }).eq("id", tournamentId).select("id");
  if (error || !data?.length) return { error: tx.cantGenerateNewCode };
  await revokeOrganizerSessions(tournamentId); // chi era entrato col vecchio codice deve rientrare
  return { organizerCode: formatOrganizerCode(code) };
}

export type GenState = { error?: string };

/** Compone i gironi, crea il calendario e lo scheletro del tabellone. Il torneo passa a "gironi in corso". */
export async function generateGroups(_prev: GenState, formData: FormData): Promise<GenState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId } = await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status, format").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: tx.tournamentNotFound };
  if (t.status !== "draft") return { error: tx.alreadyGenerated };
  const parsed = parseFormat(t.format);
  if (t.format === null) return { error: tx.setFormatFirst };
  if ("errors" in parsed) { const l = await getLocale(); return { error: parsed.errors.map((e) => translateDomainError(e, l)).join(" ") }; }
  const knockoutOnly = parsed.format.mode === "knockout";
  const { data: entryRows } = await supabase.from("entry_members").select("entry_id").eq("tournament_id", tournamentId);
  const sizes = new Map<string, number>();
  for (const r of entryRows ?? []) sizes.set(r.entry_id as string, (sizes.get(r.entry_id as string) ?? 0) + 1);
  const { data: allEntries } = await supabase.from("tournament_entries").select("id").eq("tournament_id", tournamentId);
  const expected = (await supabase.from("tournaments").select("kind").eq("id", tournamentId).maybeSingle()).data?.kind === "doubles" ? 2 : 1;
  if ((allEntries ?? []).some((e) => (sizes.get(e.id as string) ?? 0) !== expected))
    return { error: expected === 2 ? tx.playersWithoutPartner : tx.invalidEntries };

  // Teste di serie dai punti della lega (coppia = media dei due giocatori);
  // negli amichevoli senza lega, dal miglior punteggio di ognuno nelle leghe.
  const { data: members } = await supabase.from("entry_members").select("entry_id, player_id").eq("tournament_id", tournamentId);
  let ratingOf: Map<string, number>;
  if (championshipId) {
    const { data: ratings } = await supabase.from("championship_players").select("player_id, rating").eq("championship_id", championshipId);
    ratingOf = new Map((ratings ?? []).map((r) => [r.player_id as string, r.rating as number]));
  } else {
    ratingOf = hasServiceKey() ? await bestRatings((members ?? []).map((m) => m.player_id as string)) : new Map();
  }
  const byEntry = new Map<string, number[]>();
  for (const m of members ?? []) byEntry.set(m.entry_id as string, [...(byEntry.get(m.entry_id as string) ?? []), ratingOf.get(m.player_id as string) ?? 1000]);
  const players = [...byEntry].map(([id, rs]) => ({ id, rating: rs.reduce((a, b) => a + b, 0) / rs.length }));
  let plan;
  try { plan = buildTournament(players, parsed.format); } catch (e) { return { error: translateDomainError((e as Error).message, await getLocale()) }; }

  // "Prenota" il passaggio di stato: se due richieste arrivano insieme, solo una passa.
  const { data: claimed } = await supabase.from("tournaments").update({ status: knockoutOnly ? "knockout" : "groups" })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (!claimed?.length) return { error: tx.alreadyGenerated };

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
  if (e2) { await rollback(); return { error: tx.cantCreateMatches }; }
  revalidatePath(`/gestione/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return {};
}

/** Torna in preparazione cancellando gironi e partite, solo se nessun risultato è stato inserito. */
export async function resetGroups(_prev: GenState, formData: FormData): Promise<GenState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t || t.status === "draft" || t.status === "closed") return { error: tx.notAvailable };
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId).not("sets_a", "is", null);
  if (count) return { error: tx.resultsAlreadyIn(count) };
  const { error } = await supabase.from("matches").delete().eq("tournament_id", tournamentId);
  if (error) return { error: tx.cantReset };
  await supabase.from("tournament_entries").update({ group_no: null, seed: null }).eq("tournament_id", tournamentId);
  await supabase.from("tournaments").update({ status: "draft" }).eq("id", tournamentId);
  revalidatePath(`/gestione/${tournamentId}`);
  refresh(); // aggiorna subito la pagina aperta
  return {};
}

/** Correzione di un risultato da parte di un admin (prima della chiusura del torneo). */
export async function adminSubmitResult(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId); // prima della scrittura con la chiave segreta
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: translateDomainError(sets.error, await getLocale()), set: sets.set };
  const r = await saveResult(tournamentId, String(formData.get("match_id") ?? ""), sets);
  if (r.ok) { revalidatePath(`/gestione/${tournamentId}/risultati`); refresh(); }
  return r;
}

/** L'organizzatore conferma così com'è un risultato contestato. */
export async function confirmDisputedAction(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const r = await confirmDisputed(tournamentId, String(formData.get("match_id") ?? ""));
  if (r.ok) { revalidatePath(`/gestione/${tournamentId}/risultati`); refresh(); }
  return r;
}

/** Attiva o disattiva l'inserimento dei risultati da parte dei giocatori. */
export async function setPlayerResults(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const on = formData.get("player_results") === "on";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("tournaments").update({ player_results: on }).eq("id", tournamentId);
  if (error) return { error: tx.cantSave };
  revalidatePath(`/gestione/${tournamentId}`); refresh();
  return { ok: on ? tx.playersResultsOn : tx.playersResultsOff };
}

export type CloseState = { error?: string; ok?: string };

export async function closeTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId, ranked } = await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const disputed = await disputedCount(tournamentId);
  if (disputed) return { error: tx.disputedBeforeClose(disputed) };
  const r = ranked && championshipId ? await closeTournament(championshipId, tournamentId) : await closeFriendly(tournamentId);
  if (r.ok) { await revokeOrganizerSessions(tournamentId); revalidatePath(`/gestione/${tournamentId}`); revalidatePath("/"); refresh(); }
  return r;
}

export async function reopenTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const { championshipId, ranked } = await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const r = ranked && championshipId ? await reopenTournament(championshipId, tournamentId) : await reopenFriendly(tournamentId);
  if (r.ok) { revalidatePath(`/gestione/${tournamentId}`); revalidatePath("/"); refresh(); }
  return r;
}

// ── Amichevoli ────────────────────────────────────────────────────────────

/** Chi si può iscrivere: giocatori della lega, oppure (amichevole di un utente) lui, amici e ospiti. */
async function enrollablePlayerIds(access: Awaited<ReturnType<typeof requireTournamentManager>>): Promise<string[]> {
  if (access.championshipId) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.from("championship_players").select("player_id").eq("championship_id", access.championshipId);
    return (data ?? []).map((m) => m.player_id as string);
  }
  if (!access.ownerUserId || !hasServiceKey()) return [];
  return (await friendlyCandidates(access.ownerUserId)).map((c) => c.id);
}

/** Chiusura di un amichevole: nessuna classifica da aggiornare. */
async function closeFriendly(tournamentId: string): Promise<CloseState> {
  const tx = await tr(adminManageText);
  const svc = createServiceClient();
  const { data } = await svc.from("tournaments").update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", tournamentId).eq("ranked", false).in("status", ["groups", "knockout"]).select("id");
  return data?.length ? { ok: tx.friendlyClosed } : { error: tx.alreadyClosedOrNotStarted };
}

async function reopenFriendly(tournamentId: string): Promise<CloseState> {
  const tx = await tr(adminManageText);
  const svc = createServiceClient();
  const { data: ms } = await svc.from("matches").select("phase, sets_a").eq("tournament_id", tournamentId);
  const groupsOpen = (ms ?? []).some((m) => m.phase === "group" && m.sets_a === null) || !(ms ?? []).some((m) => m.phase === "knockout");
  const { data } = await svc.from("tournaments").update({ status: groupsOpen ? "groups" : "knockout", closed_at: null })
    .eq("id", tournamentId).eq("ranked", false).eq("status", "closed").select("id");
  return data?.length ? { ok: tx.reopened } : { error: tx.notClosed };
}

/** Aggiunge un ospite (giocatore senza account) agli amichevoli di chi ha creato il torneo. */
export async function addGuest(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const access = await requireTournamentManager(tournamentId);
  if (access.championshipId || !access.ownerUserId) return { error: tx.guestsOnlyFriendly };
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const name = String(formData.get("guest_name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: tx.guestNameLength };
  const svc = createServiceClient();
  const { count } = await svc.from("players").select("id", { count: "exact", head: true }).eq("guest_of", access.ownerUserId);
  if ((count ?? 0) >= 100) return { error: tx.tooManyGuests };
  const { error } = await svc.from("players").insert({ full_name: name, guest_of: access.ownerUserId });
  if (error) return { error: tx.cantAddGuest };
  revalidatePath(`/gestione/${tournamentId}`);
  refresh();
  return { ok: tx.guestAdded(name) };
}

// ── Iscrizioni dei giocatori ──────────────────────────────────────────────

/** Apre o chiude le iscrizioni autonome (solo tornei di lega, in preparazione). */
export async function setRegistration(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const access = await requireTournamentManager(tournamentId);
  if (!access.championshipId) return { error: tx.selfRegOnlyLeague };
  const open = formData.get("open") === "on";
  const raw = String(formData.get("deadline") ?? "").trim();
  const deadline = raw ? romeToIso(raw) : null;
  if (raw && !deadline) return { error: tx.invalidDeadline };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments").update({ registration_open: open, registration_deadline: deadline })
    .eq("id", tournamentId).eq("status", "draft").select("id");
  if (error) return { error: tx.cantSave };
  if (!data?.length) return { error: tx.notDraftAnymore };
  revalidatePath(`/gestione/${tournamentId}`);
  refresh();
  return { ok: open ? tx.regOpened : tx.regClosedOk };
}

/**
 * Elimina un torneo con partite e iscrizioni. Un torneo chiuso e valido per la classifica va prima
 * riaperto (così la classifica viene ricalcolata senza di lui); gli altri si eliminano direttamente.
 */
export async function deleteTournamentAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const access = await requireTournamentManager(tournamentId);
  if (!hasServiceKey()) return { error: tx.missingServiceKey };
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments").select("status, ranked, championship_id").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: tx.tournamentNotFound };
  if (t.status === "closed" && t.ranked && t.championship_id)
    return { error: tx.closedRankedReopenFirst };
  const { count: rated } = await svc.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId).eq("rated", true);
  if (rated) return { error: tx.ratedMatchesLeft };
  const { error } = await svc.from("tournaments").delete().eq("id", tournamentId);
  if (error) return { error: tx.cantDeleteTournament };
  revalidatePath("/");
  if (access.championshipId) { revalidatePath(`/admin/campionati/${access.championshipId}`); redirect(`/admin/campionati/${access.championshipId}`); }
  redirect("/profilo");
}

/** Torneo nella home di tutti (mentre è in corso) e link della diretta streaming. */
export async function setPublicAndStream(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const tx = await tr(adminManageText);
  const tournamentId = String(formData.get("tournament_id") ?? "");
  await requireTournamentManager(tournamentId);
  const stream = parseStreamUrl(String(formData.get("stream_url") ?? ""), await getLocale());
  if ("error" in stream) return { error: stream.error };
  const featured = formData.get("featured") === "on";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("tournaments").update({ featured, stream_url: stream.url }).eq("id", tournamentId);
  if (error) return { error: tx.cantSave };
  revalidatePath(`/gestione/${tournamentId}`); revalidatePath("/"); refresh();
  return { ok: tx.saved };
}
