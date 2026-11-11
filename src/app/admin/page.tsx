import Link from "next/link";

export const metadata = { title: "Amministrazione" };

export default function AdminHome() {
  return (
    <main>
      <h1 className="text-2xl font-bold">Cosa vuoi fare?</h1>
      <ul className="mt-4 space-y-2">
        <li><Link href="/admin/giocatori" className="underline">Gestisci i giocatori</Link></li>
        <li><Link href="/admin/tornei" className="underline">Tornei: crea, iscrivi i giocatori, risultati e chiusura</Link></li>
        <li><Link href="/admin/amministratori" className="underline">Amministratori</Link> (solo proprietario)</li>
        <li><Link href="/admin/password" className="underline">Cambia la tua password</Link></li>
      </ul>
    </main>
  );
}
