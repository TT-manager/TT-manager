import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChampionshipManager } from "@/lib/auth";
import { DEFAULT_RANKING, parseRankingSettings } from "@/lib/domain/ranking";
import { createServerSupabase } from "@/lib/supabase/server";
import { tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

/** Carica la lega verificando che l'admin possa gestirlo. */
export async function loadManagedChampionship(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = await requireChampionshipManager(id);
  const supabase = await createServerSupabase();
  const { data: c } = await supabase.from("championships").select("id, name, slug, kind, settings, is_public").eq("id", id).maybeSingle();
  if (!c) notFound();
  const p = parseRankingSettings(c.settings);
  return {
    admin, supabase,
    championship: { id: c.id as string, name: c.name as string, slug: c.slug as string, kind: c.kind as "singles" | "doubles", isPublic: c.is_public as boolean,
      settings: "settings" in p ? p.settings : DEFAULT_RANKING },
  };
}

const TABS = [
  ["", "tabOverview"], ["/partenza", "tabStart"], ["/assenze", "tabAbsences"], ["/impostazioni", "tabRules"],
] as const;

export async function ChampionshipHeader({ c, current }: { c: { id: string; name: string; slug: string; kind: string }; current: string }) {
  const t = await tr(adminLeaguesText);
  return (
    <div>
      <Link href="/admin/campionati" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">{t.backToLeagues}</Link>
      <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{c.kind === "doubles" ? t.doubles : t.singles} ·{" "}
        <Link href={`/c/${c.slug}`} className="underline">{t.publicPage}</Link></p>
      <nav className="mt-4 flex flex-wrap gap-2 border-b pb-2 text-sm">
        {TABS.map(([path, label]) => (
          <Link key={path} href={`/admin/campionati/${c.id}${path}`}
            className={`rounded px-3 py-1 ${current === path ? "bg-brand text-white" : "hover:text-brand"}`}>{t[label]}</Link>
        ))}
      </nav>
    </div>
  );
}

export const input = "rounded border bg-transparent px-3 py-2";
export const muted = "text-sm text-neutral-600 dark:text-neutral-400";
