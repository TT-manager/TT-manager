import Link from "next/link";
import { Suspense } from "react";
import { requireAccount } from "@/lib/account";
import FriendlyForm from "./friendly-form";

export const metadata = { title: "Nuovo torneo amichevole" };

export default function NewFriendlyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/profilo" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← Il mio profilo</Link>
      <h1 className="mt-2 text-2xl font-bold">Nuovo torneo amichevole</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">Non conta per nessuna classifica: si gioca per divertimento.</p>
      <Suspense fallback={null}><Guard /></Suspense>
    </main>
  );
}

async function Guard() {
  await requireAccount("/amichevole/nuovo");
  return <FriendlyForm />;
}
