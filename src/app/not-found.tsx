import Link from "next/link";
import { tr } from "@/i18n/server";
import { publicErrorText } from "@/i18n/dict/public-home";

export default async function NotFound() {
  const t = await tr(publicErrorText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">{t.notFoundTitle}</h1>
      <Link href="/" className="mt-4 inline-block underline">{t.backToRanking}</Link>
    </main>
  );
}
