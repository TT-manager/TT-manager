"use server";
import { randomBytes } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { setAdminOnly } from "@/lib/admin-only";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export type AdminState = { error?: string; ok?: string; tempPassword?: string; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Aggiunge un admin. Se l'email non ha ancora un account, lo crea con una password provvisoria. */
export async function addAdmin(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireOwner();
  const t = await tr(adminShellText);
  if (!hasServiceKey()) return { error: t.missingServiceKey };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return { error: t.invalidEmail };
  const svc = createServiceClient();

  let userId: string | null = null;
  let tempPassword: string | undefined;
  // Cerca un utente esistente con quell'email.
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error: t.cantReadUsers };
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    tempPassword = randomBytes(12).toString("base64url");
    const { data, error } = await svc.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
    if (error || !data.user) return { error: t.cantCreateAccount };
    userId = data.user.id;
  }
  const { error } = await svc.from("admins").insert({ user_id: userId, role: "admin" });
  if (error?.code === "23505") return { error: t.alreadyAdmin };
  if (error) return { error: t.cantAddAdmin };
  revalidatePath("/admin/amministratori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: t.nowAdmin(email), tempPassword, email };
}

export async function removeAdmin(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const owner = await requireOwner();
  const t = await tr(adminShellText);
  if (!hasServiceKey()) return { error: t.missingServiceKey };
  const userId = String(formData.get("user_id") ?? "");
  if (userId === owner.userId) return { error: t.cantRemoveSelf };
  // Il proprietario non si può togliere: si eliminano solo righe con ruolo 'admin'.
  const svc = createServiceClient();
  const { data, error } = await svc.from("admins").delete()
    .eq("user_id", userId).eq("role", "admin").select("user_id, admin_only");
  if (error || !data?.length) return { error: t.cantRemoveAdmin };
  // Chi era «solo amministratore» torna giocatore: la sua scheda non resta nascosta per sempre.
  if (data[0].admin_only) await svc.from("players").update({ active: true }).eq("user_id", userId);
  revalidatePath("/admin/amministratori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: t.adminRemoved };
}

/** Il proprietario mette o toglie la modalità «solo amministratore» a un amministratore (anche a sé). */
export async function setAdminOnlyFor(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireOwner();
  const t = await tr(adminShellText);
  if (!hasServiceKey()) return { error: t.missingServiceKey };
  const userId = String(formData.get("user_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: t.adminOnlyFailed };
  if (!(await setAdminOnly(userId, formData.get("on") === "1"))) return { error: t.adminOnlyFailed };
  revalidatePath("/admin/amministratori");
  refresh();
  return { ok: t.adminOnlyChanged };
}
