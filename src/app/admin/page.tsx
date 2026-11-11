import Link from "next/link";

export const metadata = { title: "Amministrazione" };

export default function AdminHome() {
  return (
    <main>
      <h1 className="text-2xl font-bold">Cosa vuoi fare?</h1>
      <ul className="mt-4 space-y-2">
        <li><Link href="/admin/giocatori" className="underline">Gestisci i giocatori</Link></li>
      </ul>
      <p className="mt-6 text-neutral-600 dark:text-neutral-400">Tornei e amministratori: in arrivo.</p>
    </main>
  );
}
