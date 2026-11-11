import Link from "next/link";

export default function TournamentNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">Torneo non trovato</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">Controlla il codice: sono 6 caratteri, lettere e numeri.</p>
      <Link href="/" className="mt-4 inline-block underline">Torna alla home</Link>
    </main>
  );
}
