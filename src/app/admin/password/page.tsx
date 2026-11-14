import PasswordForm from "./password-form";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).passwordTitle };
}

export default async function PasswordPage() {
  const t = await tr(adminShellText);
  return (
    <main className="max-w-sm">
      <h1 className="text-2xl font-bold">{t.passwordTitle}</h1>
      <PasswordForm />
    </main>
  );
}
