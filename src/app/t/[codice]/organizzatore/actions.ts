"use server";
import { translateDomainError } from "@/i18n/domain-errors";
import { refresh, revalidatePath } from "next/cache";
import { normalizeCode } from "@/lib/codes";
import { hasServiceKey, organizerLogin, organizerLogout, organizerTournamentId } from "@/lib/organizer";
import { saveResult, setsFromForm } from "@/lib/results";
import { getLocale, tr } from "@/i18n/server";
import { publicOrganizerText } from "@/i18n/dict/public-tournament";

export type OrgState = { error?: string; ok?: string; set?: number };

const pc = (formData: FormData) => normalizeCode(String(formData.get("public_code") ?? ""));

export async function login(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const tx = await tr(publicOrganizerText);
  if (!hasServiceKey()) return { error: tx.loginNotActive };
  const code = pc(formData);
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: tx.invalidTournament };
  const r = await organizerLogin(code, String(formData.get("code") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(`/t/${code}/organizzatore`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: tx.loggedIn };
}

export async function logout(formData: FormData) {
  const code = pc(formData);
  await organizerLogout(code);
  revalidatePath(`/t/${code}/organizzatore`);
  refresh(); // aggiorna subito la pagina aperta
}

export async function submitResult(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const code = pc(formData);
  const tournamentId = await organizerTournamentId(code);
  if (!tournamentId) return { error: (await tr(publicOrganizerText)).sessionExpired };
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: translateDomainError(sets.error, await getLocale()), set: sets.set };
  const r = await saveResult(tournamentId, String(formData.get("match_id") ?? ""), sets);
  if (r.ok) { revalidatePath(`/t/${code}`); revalidatePath(`/t/${code}/organizzatore`); refresh(); }
  return r;
}
