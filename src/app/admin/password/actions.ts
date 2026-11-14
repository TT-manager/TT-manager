"use server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export type PwState = { error?: string; ok?: string };

export async function changePassword(_prev: PwState, formData: FormData): Promise<PwState> {
  await requireAdmin();
  const t = await tr(adminShellText);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 12) return { error: t.pwTooShort };
  if (password !== confirm) return { error: t.pwMismatch };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: t.pwFailed };
  return { ok: t.pwChanged };
}
