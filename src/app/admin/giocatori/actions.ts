"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearAvatar } from "@/lib/avatar-server";
import { hasServiceKey } from "@/lib/organizer";
import { parseClubChoice } from "@/lib/clubs";

export type FormState = { error?: string; ok?: string };

function parsePlayer(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const club = parseClubChoice((k) => formData.get(k), false);
  if (full_name.length < 2) return { error: "Il nome è obbligatorio (almeno 2 lettere)." } as const;
  if (full_name.length > 80) return { error: "Nome troppo lungo." } as const;
  if ("error" in club) return { error: club.error } as const;
  return { value: { full_name, club_id: club.kind === "existing" ? club.clubId : null } } as const;
}

export async function addPlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parsePlayer(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").insert(parsed.value);
  if (error) return { error: "Non sono riuscito a salvare il giocatore." };
  revalidatePath("/admin/giocatori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: `Aggiunto ${parsed.value.full_name}.` };
}

export async function updatePlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parsePlayer(formData);
  if ("error" in parsed) return { error: parsed.error };
  const active = formData.get("active") === "on";
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").update({ ...parsed.value, active }).eq("id", id);
  if (error) return { error: "Non sono riuscito a salvare le modifiche." };
  revalidatePath("/admin/giocatori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: "Salvato." };
}

export async function deletePlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error)
    return { error: "Questo giocatore ha già partite o iscrizioni: non si può eliminare. Disattivalo, così sparisce dalla classifica." };
  revalidatePath("/admin/giocatori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: "Eliminato." };
}

/** Toglie la foto di un giocatore (per esempio se inappropriata). */
export async function removePlayerAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!hasServiceKey()) return { error: "Chiave segreta non configurata." };
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Giocatore non valido." };
  await clearAvatar(id);
  revalidatePath("/admin/giocatori");
  refresh();
  return { ok: "Foto tolta." };
}
