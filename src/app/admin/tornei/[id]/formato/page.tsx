import Link from "next/link";
import { notFound } from "next/navigation";
import FormatEditor from "@/components/format-editor";
import { requireAdmin } from "@/lib/auth";
import { parseFormat } from "@/lib/domain/format";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateFormat } from "../../actions";

export const metadata = { title: "Formato del torneo" };

export default async function FormatPage({ params }: PageProps<"/admin/tornei/[id]/formato">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createServerSupabase();
  const [{ data: t }, { count }] = await Promise.all([
    supabase.from("tournaments").select("id, name, status, format").eq("id", id).maybeSingle(),
    supabase.from("tournament_players").select("player_id", { count: "exact", head: true }).eq("tournament_id", id),
  ]);
  if (!t) notFound();
  const parsed = t.format ? parseFormat(t.format) : null;
  return (
    <main>
      <Link href={`/admin/tornei/${id}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {t.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">Formato del torneo</h1>
      {t.status !== "draft"
        ? <p className="mt-4">Gironi, tabellone o calendario sono già stati generati: il formato non si può più cambiare. Per modificarlo usa «Annulla» nella pagina del torneo (solo se non ci sono risultati).</p>
        : <FormatEditor action={updateFormat} hidden={{ tournament_id: id }}
            initial={parsed && "format" in parsed ? parsed.format : null} enrolled={count ?? 0} />}
    </main>
  );
}
