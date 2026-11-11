import NewTournamentForm from "./new-tournament-form";

export const metadata = { title: "Nuovo torneo" };

export default function NewTournamentPage() {
  return (
    <main>
      <h1 className="text-2xl font-bold">Nuovo torneo</h1>
      <NewTournamentForm />
    </main>
  );
}
