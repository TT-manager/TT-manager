"use server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/account";
import { parseClubChoice } from "@/lib/clubs";
import { siteOrigin as origin } from "@/lib/origin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLocale, tr } from "@/i18n/server";
import { accountLoginText } from "@/i18n/dict/account-login";
import { clubErrorText } from "@/i18n/dict/account-clubs";

export type LoginState = { error?: string; ok?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const t = await tr(accountLoginText);
  if (!email || !password) return { error: t.missingCredentials };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") return { error: t.emailNotConfirmed };
  if (error) return { error: t.wrongCredentials };
  const next = formData.get("next");
  if (typeof next === "string" && next) redirect(safeNext(next));
  redirect("/"); // la home mostra la dashboard; l'area admin è nella barra in alto
}

export async function signup(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const club = parseClubChoice((k) => formData.get(k));
  const next = safeNext(formData.get("next"));
  const t = await tr(accountLoginText);
  if (fullName.length < 2 || fullName.length > 80) return { error: t.nameLength };
  if ("error" in club) return { error: clubErrorText(club.error, await getLocale()) };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: t.invalidEmail };
  if (password.length < 8) return { error: t.passwordTooShort };
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
  if (error?.code === "weak_password") return { error: t.weakPassword };
  if (error?.code === "over_email_send_rate_limit") return { error: t.tooManySignups };
  if (error) return { error: t.signupFailed };
  if (data.session) redirect(next); // conferma email disattivata: si entra subito
  return { ok: t.checkEmail };
}

export async function forgotPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const t = await tr(accountLoginText);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: t.invalidEmail };
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/conferma?next=/nuova-password` });
  // Stessa risposta in ogni caso: non riveliamo quali email sono registrate.
  return { ok: t.resetSent };
}

export async function setNewPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const t = await tr(accountLoginText);
  if (password.length < 8) return { error: t.passwordTooShort };
  if (password !== String(formData.get("confirm") ?? "")) return { error: t.passwordsDiffer };
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: t.linkExpired };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: t.passwordChangeFailed };
  return { ok: t.passwordChanged };
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
