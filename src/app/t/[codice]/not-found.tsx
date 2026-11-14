import Link from "next/link";
import { tr } from "@/i18n/server";
import { publicErrorText } from "@/i18n/dict/public-home";

export default async function TournamentNotFound() {
  const t = await tr(publicErrorText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">{t.tournamentNotFound}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t.checkCode}</p>
      <Link href="/" className="mt-4 inline-block underline">{t.backHome}</Link>
    </main>
  );
}
