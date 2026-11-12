import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/labels";

export const metadata = { title: "Tornei" };


export default async function TournamentsPage() {
  await requireAdmin();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .select("id, name, starts_on, status, public_code, ranked, championship_id, championships(name)").order("created_at", { ascending: false });
  if (error) throw new Error("Impossibile leggere i tornei");
  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tornei</h1>
        <Link href="/admin/tornei/nuovo" className="btn-primary">Nuovo torneo</Link>
      </div>
      {data.length === 0 ? <p className="mt-6 text-neutral-600 dark:text-neutral-400">Nessun torneo.</p> : (
        <ul className="mt-6 divide-y">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
              <Link href={`/gestione/${t.id}`} className="font-medium underline-offset-2 hover:underline">{t.name}</Link>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {t.championship_id ? (t.championships as unknown as { name: string } | null)?.name : "Amichevole di un utente"}{t.championship_id && !t.ranked ? " (amichevole)" : ""} · {t.starts_on ? new Date(t.starts_on).toLocaleDateString("it-IT") : "senza data"} · {STATUS_LABEL[t.status]} · codice {t.public_code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
