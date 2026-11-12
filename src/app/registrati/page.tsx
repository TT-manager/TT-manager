import { Suspense } from "react";
import { safeNext } from "@/lib/account";
import { listClubs } from "@/lib/clubs-server";
import { SignupForm } from "../login/login-form";

export const metadata = { title: "Registrati" };

export default function SignupPage({ searchParams }: PageProps<"/registrati">) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Registrati</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Con un account puoi chiedere di partecipare ai campionati e vedere la tua scheda.</p>
      <Suspense fallback={<SignupForm />}><WithParams searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/registrati">["searchParams"] }) {
  const [{ next }, clubs] = await Promise.all([searchParams, listClubs()]);
  return <SignupForm next={typeof next === "string" ? safeNext(next) : undefined} clubs={clubs} />;
}
