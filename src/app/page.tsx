export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Campionato di tennis tavolo</h1>
      <p className="mt-3 text-neutral-600">
        Classifica generale, tornei e risultati in diretta.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border p-5">
          <h2 className="font-semibold">Classifica</h2>
          <p className="mt-1 text-sm text-neutral-600">In arrivo: ranking Elo dei giocatori.</p>
        </section>
        <section className="rounded-lg border p-5">
          <h2 className="font-semibold">Hai un codice torneo?</h2>
          <p className="mt-1 text-sm text-neutral-600">In arrivo: accesso a /t/CODICE.</p>
        </section>
      </div>
    </main>
  );
}
