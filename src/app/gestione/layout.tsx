import Link from "next/link";
import { Suspense } from "react";

// Gestione di un torneo: per admin dei campionati e per chi ha creato un amichevole.
// I permessi sono verificati in ogni pagina e azione (requireTournamentManager).
export default function ManageLayout({ children }: LayoutProps<"/gestione">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-3 text-sm">
        <Link href="/" className="font-bold">Tennis tavolo</Link>
        <Link href="/profilo" className="hover:underline">Il mio profilo</Link>
        <Link href="/admin" className="hover:underline">Amministrazione</Link>
      </header>
      <Suspense fallback={<p>Caricamento…</p>}>{children}</Suspense>
    </div>
  );
}
