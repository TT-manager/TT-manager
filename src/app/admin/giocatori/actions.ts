"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requirePlayerManager } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearAvatar } from "@/lib/avatar-server";
import { hasServiceKey } from "@/lib/organizer";
import { parseClubChoice } from "@/lib/clubs";
import { getLocale, tr } from "@/i18n/server";
import { clubErrorText } from "@/i18n/dict/account-clubs";
import { adminShellText } from "@/i18n/dict/admin-shell";

export type FormState = { error?: string; ok?: string };

async function parsePlayer(formData: FormData) {
  const t = await tr(adminShellText);
  const full_name = String(formData.get("full_name") ?? "").trim();
  const club = parseClubChoice((k) => formData.get(k), false);
  if (full_name.length < 2) return { error: t.nameRequired } as const;
  if (full_name.length > 80) return { error: t.nameTooLong } as const;
  if ("error" in club) return { error: clubErrorText(club.error, await getLocale()) } as const;
  return { value: { full_name, club_id: club.kind === "existing" ? club.clubId : null } } as const;
}

/** Nuovo giocatore dall'elenco generale (solo proprietario; gli amministratori li creano dal circuito). */
export async function addPlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const parsed = await parsePlayer(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").insert(parsed.value);
  if (error) return { error: t.cantSavePlayer };
  revalidatePath("/admin/giocatori", "layout");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: t.playerAdded(parsed.value.full_name) };
}

/** Nome e circolo: anche l'amministratore di un circuito del giocatore. Attivo/disattivato solo il proprietario. */
export async function updatePlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr(adminShellText);
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: t.invalidPlayer };
  const admin = await requirePlayerManager(id);
  const parsed = await parsePlayer(formData);
  if ("error" in parsed) return { error: parsed.error };
  const change = admin.role === "owner" ? { ...parsed.value, active: formData.get("active") === "on" } : parsed.value;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").update(change).eq("id", id);
  if (error) return { error: t.cantSaveChanges };
  revalidatePath("/admin/giocatori", "layout");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: t.saved };
}

export async function deletePlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error)
    return { error: t.playerInUse };
  revalidatePath("/admin/giocatori");
  // Dalla scheda del giocatore si torna all'elenco.
  if (formData.get("back_to_list") === "1") redirect("/admin/giocatori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: t.deleted };
}

/** Toglie la foto di un giocatore (per esempio se inappropriata). */
export async function removePlayerAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr(adminShellText);
  if (!hasServiceKey()) return { error: t.serviceKeyNotSet };
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: t.invalidPlayer };
  await requirePlayerManager(id);
  await clearAvatar(id);
  revalidatePath("/admin/giocatori", "layout");
  refresh();
  return { ok: t.photoRemoved };
}

/** Disattiva o riattiva un giocatore (pulsante nella scheda). */
export async function setPlayerActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").update({ active }).eq("id", id);
  if (error) return { error: t.cantSaveChanges };
  revalidatePath("/admin/giocatori", "layout");
  refresh();
  return { ok: active ? t.playerReactivated : t.playerDeactivated };
}
