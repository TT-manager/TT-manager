"use server";
import { randomBytes } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";

export type AdminState = { error?: string; ok?: string; tempPassword?: string; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Aggiunge un admin. Se l'email non ha ancora un account, lo crea con una password provvisoria. */
export async function addAdmin(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireOwner();
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return { error: "Email non valida." };
  const svc = createServiceClient();

  let userId: string | null = null;
  let tempPassword: string | undefined;
  // Cerca un utente esistente con quell'email.
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error: "Non riesco a leggere gli utenti." };
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    tempPassword = randomBytes(12).toString("base64url");
    const { data, error } = await svc.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
    if (error || !data.user) return { error: "Non sono riuscito a creare l'account." };
    userId = data.user.id;
  }
  const { error } = await svc.from("admins").insert({ user_id: userId, role: "admin" });
  if (error?.code === "23505") return { error: "Questa persona è già amministratore." };
  if (error) return { error: "Non sono riuscito ad aggiungere l'amministratore." };
  revalidatePath("/admin/amministratori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: `${email} è ora amministratore.`, tempPassword, email };
}

export async function removeAdmin(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const owner = await requireOwner();
  if (!hasServiceKey()) return { error: "Manca la configurazione del server (chiave segreta)." };
  const userId = String(formData.get("user_id") ?? "");
  if (userId === owner.userId) return { error: "Non puoi togliere te stesso." };
  // Il proprietario non si può togliere: si eliminano solo righe con ruolo 'admin'.
  const { data, error } = await createServiceClient().from("admins").delete()
    .eq("user_id", userId).eq("role", "admin").select("user_id");
  if (error || !data?.length) return { error: "Non sono riuscito a togliere l'amministratore." };
  revalidatePath("/admin/amministratori");
  refresh(); // aggiorna subito la pagina aperta
  return { ok: "Amministratore tolto. L'account resta, ma non ha più accesso all'area admin." };
}
