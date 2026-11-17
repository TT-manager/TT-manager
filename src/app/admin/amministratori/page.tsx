import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { AddAdminForm, RemoveAdminButton } from "./forms";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).adminsTitle };
}

export default async function AdminsPage() {
  const me = await requireOwner();
  const t = await tr(adminShellText);
  const l = await getLocale();
  if (!hasServiceKey()) return <p>{t.missingServiceKey}</p>;
  const svc = createServiceClient();
  const [{ data: rows }, { data: links }, { data: leagues }] = await Promise.all([
    svc.from("admins").select("user_id, role, created_at").order("created_at"),
    svc.from("championship_admins").select("user_id, championship_id"),
    svc.from("championships").select("id, name").order("name"),
  ]);
  const leagueName = new Map((leagues ?? []).map((c) => [c.id as string, c.name as string]));
  const admins = await Promise.all((rows ?? []).map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id);
    const email = data.user?.email ?? t.deletedAccount;
    return {
      ...r, email, lastSignIn: data.user?.last_sign_in_at ?? null,
      leagues: (links ?? []).filter((x) => x.user_id === r.user_id).map((x) => ({ id: x.championship_id as string, name: leagueName.get(x.championship_id as string) ?? "?" })),
    };
  }));
  const date = (iso: string) => new Date(iso).toLocaleDateString(intlTag(l), { day: "numeric", month: "short", year: "numeric" });
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.adminsTitle} <span className="ml-1 text-base font-normal text-muted">({admins.length})</span></h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t.adminsIntro}</p>
      <AddAdminForm />
      <ul className="mt-6 grid gap-3">
        {admins.map((a) => {
          const owner = a.role === "owner";
          return (
            <li key={a.user_id} className="card flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ${owner ? "bg-brand text-white" : "bg-neutral-300 text-ink dark:bg-neutral-700 dark:text-white"}`}>
                  {(a.email[0] ?? "?").toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere] font-semibold">{a.email}
                    {a.user_id === me.userId && <span className="ml-2 text-sm font-normal text-muted">({t.you})</span>}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span className={owner ? "badge-open" : "badge-muted"}>{owner ? t.roleOwner : t.roleAdmin}</span>
                    <span>{t.adminsLastAccess}: {a.lastSignIn ? date(a.lastSignIn) : t.neverSignedIn}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                    {owner ? <span className="text-muted">{t.adminsOwnerNote}</span>
                      : a.leagues.length === 0 ? <span className="text-amber-600 dark:text-amber-400">{t.adminsNoLeagues}</span>
                      : <>
                          <span className="text-muted">{t.adminsManages}:</span>
                          {a.leagues.map((c) => (
                            <Link key={c.id} href={`/admin/campionati/${c.id}`} className="rounded-full border border-line px-2.5 py-0.5 hover:border-brand hover:text-brand">{c.name}</Link>))}
                        </>}
                  </div>
                </div>
              </div>
              {!owner && a.user_id !== me.userId && <div className="shrink-0"><RemoveAdminButton userId={a.user_id} email={a.email} /></div>}
            </li>);
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">{t.adminsAssignHint}</p>
    </main>
  );
}
