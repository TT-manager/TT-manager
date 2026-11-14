import { Suspense } from "react";
import { safeNext } from "@/lib/account";
import LoginForm from "./login-form";
import { tr } from "@/i18n/server";
import { accountLoginText } from "@/i18n/dict/account-login";

export async function generateMetadata() {
  return { title: (await tr(accountLoginText)).loginTitle };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await tr(accountLoginText);
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{t.loginTitle}</h1>
      <Suspense fallback={<LoginForm />}><WithParams searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [sp, t] = await Promise.all([searchParams, tr(accountLoginText)]);
  return <>
    {sp.errore === "link" && <p role="alert" className="mt-4 text-red-700 dark:text-red-400">{t.badLink}</p>}
    <LoginForm next={typeof sp.next === "string" ? safeNext(sp.next) : undefined} />
  </>;
}
