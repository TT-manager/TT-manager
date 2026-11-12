import Link from "next/link";
import { managedChampionships } from "@/lib/auth";
import NewTournamentForm from "./new-tournament-form";

export const metadata = { title: "Nuovo torneo" };

export default async function NewTournamentPage({ searchParams }: PageProps<"/admin/tornei/nuovo">) {
  const championships = await managedChampionships();
  const wanted = (await searchParams).campionato;
  const preselected = typeof wanted === "string" && championships.some((c) => c.id === wanted) ? wanted : championships[0]?.id;
  return (
    <main>
      <h1 className="text-2xl font-bold">Nuovo torneo</h1>
      {championships.length === 0
        ? <p className="mt-4">Non gestisci ancora nessun campionato. <Link href="/admin/campionati" className="underline">Vai ai campionati</Link></p>
        : <NewTournamentForm championships={championships.map((c) => ({ id: c.id as string, name: c.name as string }))} preselected={preselected} />}
    </main>
  );
}
