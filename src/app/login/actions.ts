"use server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/account";
import { parseClubChoice } from "@/lib/clubs";
import { siteOrigin as origin } from "@/lib/origin";
import { createServerSupabase } from "@/lib/supabase/server";

export type LoginState = { error?: string; ok?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") return { error: "Devi prima confermare l'email: apri il link che ti abbiamo mandato." };
  if (error) return { error: "Email o password non corrette." };
  const next = formData.get("next");
  if (typeof next === "string" && next) redirect(safeNext(next));
  const { data: admin } = await supabase.from("admins").select("role").eq("user_id", data.user.id).maybeSingle();
  redirect(admin ? "/admin" : "/profilo");
}

export async function signup(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const club = parseClubChoice((k) => formData.get(k));
  const next = safeNext(formData.get("next"));
  if (fullName.length < 2 || fullName.length > 80) return { error: "Scrivi nome e cognome (2-80 caratteri)." };
  if ("error" in club) return { error: club.error };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Email non valida." };
  if (password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: {
        full_name: fullName,
        club_id: club.kind === "existing" ? club.clubId : null,
        club_request: club.kind === "request" ? { name: club.name, city: club.city } : null,
      }, emailRedirectTo: `${await origin()}/auth/conferma?next=${encodeURIComponent(next)}` },
  });
  if (error?.code === "weak_password") return { error: "Password troppo semplice: scegline una più lunga o meno comune." };
  if (error?.code === "over_email_send_rate_limit") return { error: "Troppe registrazioni in poco tempo: riprova tra un'ora." };
  if (error) return { error: "Registrazione non riuscita. Riprova più tardi." };
  if (data.session) redirect(next); // conferma email disattivata: si entra subito
  return { ok: "Ti abbiamo mandato un'email: apri il link per confermare l'indirizzo e completare la registrazione. (Se l'indirizzo era già registrato, accedi o usa «Password dimenticata».)" };
}

export async function forgotPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Email non valida." };
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/conferma?next=/nuova-password` });
  // Stessa risposta in ogni caso: non riveliamo quali email sono registrate.
  return { ok: "Se l'indirizzo è registrato, riceverai un'email con il link per scegliere una nuova password." };
}

export async function setNewPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Le due password non coincidono." };
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Il link è scaduto: richiedine uno nuovo." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Non sono riuscito a cambiare la password (scegline una diversa dalla precedente)." };
  return { ok: "Password cambiata." };
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
