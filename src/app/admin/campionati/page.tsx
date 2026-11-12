import Link from "next/link";
import { getAdmin, managedChampionships } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { createChampionship } from "./actions";

export const metadata = { title: "Leghe" };
const input = "rounded border bg-transparent px-3 py-2";

export default async function ChampionshipsPage() {
  const [admin, list] = await Promise.all([getAdmin(), managedChampionships()]);
  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Leghe</h1>
        {list.length === 0
          ? <p className="mt-4 text-neutral-600 dark:text-neutral-400">
              {admin?.role === "owner" ? "Nessun campionato: creane uno qui sotto." : "Non gestisci ancora nessun campionato: chiedi al proprietario di assegnartene uno."}</p>
          : <ul className="mt-4 divide-y">
              {list.map((c) => (
                <li key={c.id as string} className="flex flex-wrap items-baseline gap-x-4 py-3">
                  <Link href={`/admin/campionati/${c.id}`} className="font-medium hover:underline">{c.name as string}</Link>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">{c.kind === "doubles" ? "Doppio" : "Singolare"}</span>
                </li>
              ))}
            </ul>}
      </div>
      {admin?.role === "owner" && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Nuova lega</h2>
          <ActionForm action={createChampionship} submitLabel="Crea lega" className="mt-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="grid gap-1">Nome<input name="name" required maxLength={100} className={input} placeholder="es. Lega sociale 2027" /></label>
              <label className="grid gap-1">Tipo
                <select name="kind" className={`select-arrow ${input}`} defaultValue="singles">
                  <option value="singles">Singolare</option>
                  <option value="doubles">Doppio</option>
                </select></label>
            </div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Il tipo non si può cambiare dopo. Le regole della classifica le imposti nella pagina della lega.</p>
          </ActionForm>
        </section>
      )}
    </main>
  );
}
