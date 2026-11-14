import { Suspense } from "react";
import { safeNext } from "@/lib/account";
import { listClubs } from "@/lib/clubs-server";
import { SignupForm } from "../login/login-form";
import { tr } from "@/i18n/server";
import { accountLoginText } from "@/i18n/dict/account-login";

export async function generateMetadata() {
  return { title: (await tr(accountLoginText)).signupTitle };
}

export default async function SignupPage({ searchParams }: PageProps<"/registrati">) {
  const t = await tr(accountLoginText);
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{t.signupTitle}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.signupIntro}</p>
      <Suspense fallback={<SignupForm />}><WithParams searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/registrati">["searchParams"] }) {
  const [{ next }, clubs] = await Promise.all([searchParams, listClubs()]);
  return <SignupForm next={typeof next === "string" ? safeNext(next) : undefined} clubs={clubs} />;
}
