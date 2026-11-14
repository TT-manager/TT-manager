import Link from "next/link";
import { Suspense } from "react";
import { requireAccount } from "@/lib/account";
import FriendlyForm from "./friendly-form";
import { tr } from "@/i18n/server";
import { accountFriendlyText } from "@/i18n/dict/account-friends";

export async function generateMetadata() {
  return { title: (await tr(accountFriendlyText)).title };
}

export default async function NewFriendlyPage() {
  const t = await tr(accountFriendlyText);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/profilo" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">{t.myProfile}</Link>
      <h1 className="mt-2 text-2xl font-bold">{t.title}</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">{t.intro}</p>
      <Suspense fallback={null}><Guard /></Suspense>
    </main>
  );
}

async function Guard() {
  await requireAccount("/amichevole/nuovo");
  return <FriendlyForm />;
}
