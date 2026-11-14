"use server";
import { refresh, revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim().replace(/\s+/g, " ");

type T = (typeof adminShellText)["it"];

function parseClub(t: T, f: FormData) {
  const name = str(f, "name"), city = str(f, "city");
  if (name.length < 2 || name.length > 80) return { error: t.clubNameLength } as const;
  if (city.length > 60) return { error: t.cityTooLong } as const;
  return { value: { name, city: city || null } } as const;
}

const duplicate = (t: T, code?: string) => code === "23505" ? t.clubDuplicate : null;

function done(ok: string): ActionState {
  revalidatePath("/admin/circoli"); refresh();
  return { ok };
}

export async function addClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const parsed = parseClub(t, formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await (await createServerSupabase()).from("clubs").insert(parsed.value);
  if (error) return { error: duplicate(t, error.code) ?? t.cantAddClub };
  return done(t.clubAdded(parsed.value.name));
}

export async function updateClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const id = str(formData, "id");
  const parsed = parseClub(t, formData);
  if (!UUID.test(id)) return { error: t.invalidClub };
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await (await createServerSupabase()).from("clubs").update(parsed.value).eq("id", id);
  if (error) return { error: duplicate(t, error.code) ?? t.cantSave };
  return done(t.saved);
}

/** Elimina il circolo: i suoi giocatori restano, senza circolo. */
export async function deleteClub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const id = str(formData, "id");
  if (!UUID.test(id)) return { error: t.invalidClub };
  const { error } = await (await createServerSupabase()).from("clubs").delete().eq("id", id);
  if (error) return { error: t.cantDeleteClub };
  return done(t.clubDeleted);
}

/**
 * Decide una richiesta: «approve» crea il circolo (con nome e città eventualmente corretti),
 * «assign» assegna un circolo già in elenco, «reject» la rifiuta.
 */
export async function decideClubRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner();
  const t = await tr(adminShellText);
  const id = str(formData, "request_id"), decision = str(formData, "decision");
  if (!UUID.test(id)) return { error: t.invalidRequest };
  const svc = createServiceClient();
  const { data: req } = await svc.from("club_requests").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!req || req.status !== "pending") return { error: t.requestNotPending };
  const close = (status: "approved" | "rejected", clubId: string | null) => svc.from("club_requests")
    .update({ status, club_id: clubId, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");

  if (decision === "reject") {
    await close("rejected", null);
    return done(t.requestRejected);
  }
  let clubId: string;
  if (decision === "assign") {
    clubId = str(formData, "club_id");
    if (!UUID.test(clubId)) return { error: t.chooseClubToAssign };
  } else if (decision === "approve") {
    const parsed = parseClub(t, formData);
    if ("error" in parsed) return { error: parsed.error };
    const { data: club, error } = await (await createServerSupabase()).from("clubs").insert(parsed.value).select("id").single();
    if (error) return { error: error.code === "23505" ? t.clubDuplicateUseAssign : t.cantCreateClub };
    clubId = club.id as string;
  } else return { error: t.invalidChoice };

  const { error: upd } = await svc.from("players").update({ club_id: clubId }).eq("user_id", req.user_id);
  if (upd) return { error: t.cantAssignClub };
  await close("approved", clubId);
  return done(decision === "approve" ? t.clubCreatedAssigned : t.clubAssigned);
}
