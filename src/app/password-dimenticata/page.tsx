import { ForgotForm } from "../login/login-form";
import { tr } from "@/i18n/server";
import { accountLoginText } from "@/i18n/dict/account-login";

export async function generateMetadata() {
  return { title: (await tr(accountLoginText)).forgotTitle };
}

export default async function ForgotPage() {
  const t = await tr(accountLoginText);
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{t.forgotTitle}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.forgotIntro}</p>
      <ForgotForm />
    </main>
  );
}
