"use server";
import { refresh, revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim().replace(/\s+/g, " ");

function parseClub(f: FormData) {
  const name = str(f, "name"), city = str(f, "city");
  if (name.length < 2 || name.length > 80) return { error: "Il nome del circolo deve avere 2-80 caratteri." } as const;
  if (city.length > 60) return { error: "Nome della città troppo lungo." } as const;
  return { value: { name, city: city || null } } as const;
}

const duplicate = (code?: string) => code === "23505" ? "C'è già un circolo con questo nome." : null;

function done(ok: string): ActionState {
  revalidatePath("/admin/circoli"); refresh();
  return { ok };
}

export async function addClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = parseClub(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await (await createServerSupabase()).from("clubs").insert(parsed.value);
  if (error) return { error: duplicate(error.code) ?? "Non sono riuscito ad aggiungere il circolo." };
  return done(`Aggiunto ${parsed.value.name}.`);
}

export async function updateClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const id = str(formData, "id");
  const parsed = parseClub(formData);
  if (!UUID.test(id)) return { error: "Circolo non valido." };
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await (await createServerSupabase()).from("clubs").update(parsed.value).eq("id", id);
  if (error) return { error: duplicate(error.code) ?? "Non sono riuscito a salvare." };
  return done("Salvato.");
}

/** Elimina il circolo: i suoi giocatori restano, senza circolo. */
export async function deleteClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const id = str(formData, "id");
  if (!UUID.test(id)) return { error: "Circolo non valido." };
  const { error } = await (await createServerSupabase()).from("clubs").delete().eq("id", id);
  if (error) return { error: "Non sono riuscito a eliminare il circolo." };
  return done("Circolo eliminato.");
}

/**
 * Decide una richiesta: «approve» crea il circolo (con nome e città eventualmente corretti),
 * «assign» assegna un circolo già in elenco, «reject» la rifiuta.
 */
export async function decideClubRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const id = str(formData, "request_id"), decision = str(formData, "decision");
  if (!UUID.test(id)) return { error: "Richiesta non valida." };
  const svc = createServiceClient();
  const { data: req } = await svc.from("club_requests").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!req || req.status !== "pending") return { error: "La richiesta non è più in attesa." };
  const close = (status: "approved" | "rejected", clubId: string | null) => svc.from("club_requests")
    .update({ status, club_id: clubId, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");

  if (decision === "reject") {
    await close("rejected", null);
    return done("Richiesta rifiutata.");
  }
  let clubId: string;
  if (decision === "assign") {
    clubId = str(formData, "club_id");
    if (!UUID.test(clubId)) return { error: "Scegli il circolo da assegnare." };
  } else if (decision === "approve") {
    const parsed = parseClub(formData);
    if ("error" in parsed) return { error: parsed.error };
    const { data: club, error } = await (await createServerSupabase()).from("clubs").insert(parsed.value).select("id").single();
    if (error) return { error: error.code === "23505" ? "C'è già un circolo con questo nome: usa «Assegna un circolo esistente»." : "Non sono riuscito a creare il circolo." };
    clubId = club.id as string;
  } else return { error: "Scelta non valida." };

  const { error: upd } = await svc.from("players").update({ club_id: clubId }).eq("user_id", req.user_id);
  if (upd) return { error: "Non sono riuscito ad assegnare il circolo al giocatore." };
  await close("approved", clubId);
  return done(decision === "approve" ? "Circolo creato e assegnato." : "Circolo assegnato.");
}
