import Link from "next/link";
import { managedChampionships } from "@/lib/auth";
import NewTournamentForm from "./new-tournament-form";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).newTournament };
}

export default async function NewTournamentPage({ searchParams }: PageProps<"/admin/tornei/nuovo">) {
  const t = await tr(adminShellText);
  const championships = await managedChampionships();
  const wanted = (await searchParams).campionato;
  const preselected = typeof wanted === "string" && championships.some((c) => c.id === wanted) ? wanted : championships[0]?.id;
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.newTournament}</h1>
      {championships.length === 0
        ? <p className="mt-4">{t.noLeaguesYet} <Link href="/admin/campionati" className="underline">{t.goToLeagues}</Link></p>
        : <NewTournamentForm championships={championships.map((c) => ({ id: c.id as string, name: c.name as string }))} preselected={preselected} />}
    </main>
  );
}
