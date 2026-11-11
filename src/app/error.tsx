"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">Qualcosa non ha funzionato</h1>
      <p className="mt-2 text-neutral-600">Non riesco a caricare i dati. Riprova tra poco.</p>
      <button onClick={reset} className="mt-4 rounded border px-4 py-2">Riprova</button>
    </main>
  );
}
