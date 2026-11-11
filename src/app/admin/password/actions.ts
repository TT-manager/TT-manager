"use server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export type PwState = { error?: string; ok?: string };

export async function changePassword(_prev: PwState, formData: FormData): Promise<PwState> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 12) return { error: "La password deve avere almeno 12 caratteri." };
  if (password !== confirm) return { error: "Le due password non coincidono." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Non sono riuscito a cambiare la password (scegline una diversa dalla attuale)." };
  return { ok: "Password cambiata." };
}
