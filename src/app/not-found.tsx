import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">Pagina non trovata</h1>
      <Link href="/" className="mt-4 inline-block underline">Torna alla classifica</Link>
    </main>
  );
}
