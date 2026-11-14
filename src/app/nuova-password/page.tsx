import { NewPasswordForm } from "../login/login-form";
import { tr } from "@/i18n/server";
import { accountLoginText } from "@/i18n/dict/account-login";

export async function generateMetadata() {
  return { title: (await tr(accountLoginText)).newPasswordTitle };
}

export default async function NewPasswordPage() {
  const t = await tr(accountLoginText);
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{t.newPasswordHeading}</h1>
      <NewPasswordForm />
    </main>
  );
}
