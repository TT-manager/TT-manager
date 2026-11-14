import Link from "next/link";
import { notFound } from "next/navigation";
import FormatEditor from "@/components/format-editor";
import { requireTournamentManager } from "@/lib/auth";
import { parseFormat } from "@/lib/domain/format";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateFormat } from "@/app/gestione/actions";
import { tr } from "@/i18n/server";
import { adminManageText } from "@/i18n/dict/admin-manage";

export async function generateMetadata() {
  return { title: (await tr(adminManageText)).formatTitle };
}

export default async function FormatPage({ params }: PageProps<"/gestione/[id]/formato">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireTournamentManager(id);
  const tx = await tr(adminManageText);
  const supabase = await createServerSupabase();
  const [{ data: t }, { count }] = await Promise.all([
    supabase.from("tournaments").select("id, name, status, format").eq("id", id).maybeSingle(),
    supabase.from("tournament_entries").select("id", { count: "exact", head: true }).eq("tournament_id", id),
  ]);
  if (!t) notFound();
  const parsed = t.format ? parseFormat(t.format) : null;
  return (
    <main>
      <Link href={`/gestione/${id}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {t.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">{tx.formatTitle}</h1>
      {t.status !== "draft"
        ? <p className="mt-4">{tx.formatLocked}</p>
        : <FormatEditor action={updateFormat} hidden={{ tournament_id: id }}
            initial={parsed && "format" in parsed ? parsed.format : null} enrolled={count ?? 0} />}
    </main>
  );
}
