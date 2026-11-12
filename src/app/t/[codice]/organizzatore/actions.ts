"use server";
import { refresh, revalidatePath } from "next/cache";
import { normalizeCode } from "@/lib/codes";
import { hasServiceKey, organizerLogin, organizerLogout, organizerTournamentId } from "@/lib/organizer";
import { saveResult, setsFromForm } from "@/lib/results";

export type OrgState = { error?: string; ok?: string; set?: number };

const pc = (formData: FormData) => normalizeCode(String(formData.get("public_code") ?? ""));

export async function login(_prev: OrgState, formData: FormData): Promise<OrgState> {
  if (!hasServiceKey()) return { error: "Inserimento risultati non ancora attivo: manca la configurazione del server." };
  const code = pc(formData);
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: "Torneo non valido." };
  const r = await organizerLogin(code, String(formData.get("code") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath(`/t/${code}/organizzatore`);
  refresh(); // aggiorna subito la pagina aperta
  return { ok: "Accesso eseguito." };
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
  if (!tournamentId) return { error: "Sessione scaduta: inserisci di nuovo il codice organizzatore." };
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: sets.error, set: sets.set };
  const r = await saveResult(tournamentId, String(formData.get("match_id") ?? ""), sets);
  if (r.ok) { revalidatePath(`/t/${code}`); revalidatePath(`/t/${code}/organizzatore`); refresh(); }
  return r;
}
