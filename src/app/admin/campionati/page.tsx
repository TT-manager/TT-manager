import Link from "next/link";
import { getAdmin, managedChampionships } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { createChampionship } from "./actions";
import { tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).leaguesTitle };
}
const input = "rounded border bg-transparent px-3 py-2";

export default async function ChampionshipsPage() {
  const [admin, list] = await Promise.all([getAdmin(), managedChampionships()]);
  const t = await tr(adminLeaguesText);
  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.leaguesTitle}</h1>
        {list.length === 0
          ? <p className="mt-4 text-neutral-600 dark:text-neutral-400">
              {admin?.role === "owner" ? t.noLeaguesOwner : t.noLeaguesAdmin}</p>
          : <ul className="mt-4 divide-y">
              {list.map((c) => (
                <li key={c.id as string} className="flex flex-wrap items-baseline gap-x-4 py-3">
                  <Link href={`/admin/campionati/${c.id}`} className="font-medium hover:underline">{c.name as string}</Link>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">{c.kind === "doubles" ? t.doubles : t.singles}</span>
                </li>
              ))}
            </ul>}
      </div>
      {admin?.role === "owner" && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{t.newLeague}</h2>
          <ActionForm action={createChampionship} submitLabel={t.createLeague} className="mt-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="grid gap-1">{t.name}<input name="name" required maxLength={100} className={input} placeholder={t.namePlaceholder} /></label>
              <label className="grid gap-1">{t.type}
                <select name="kind" className={`select-arrow ${input}`} defaultValue="singles">
                  <option value="singles">{t.singles}</option>
                  <option value="doubles">{t.doubles}</option>
                </select></label>
            </div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.typeNote}</p>
          </ActionForm>
        </section>
      )}
    </main>
  );
}
