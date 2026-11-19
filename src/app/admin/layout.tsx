import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";
import { AdminNav } from "./admin-nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Suspense fallback={<Loading />}>
        <Header />
        {children}
      </Suspense>
    </div>
  );
}

async function Loading() {
  return <p data-loading>{(await tr(adminShellText)).loading}</p>;
}

async function Header() {
  const t = await tr(adminShellText);
  const admin = await requireAdmin(); // controllo sul database a ogni richiesta
  const { count: pendingClubs } = admin.role === "owner"
    ? await (await createServerSupabase()).from("club_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
    : { count: 0 };
  const items = [
    { href: "/admin", label: t.navOverview },
    { href: "/admin/campionati", label: t.navLeagues },
    { href: "/admin/tornei", label: t.navTournaments },
    { href: "/admin/avvisi", label: t.navNotices },
    ...(admin.role === "owner" ? [
      { href: "/admin/giocatori", label: t.navPlayers },
      { href: "/admin/circoli", label: t.navClubs, badge: pendingClubs ?? 0 },
      { href: "/admin/amministratori", label: t.navAdmins },
      { href: "/admin/backup", label: t.navBackup },
    ] : []),
    { href: "/admin/password", label: t.navPassword },
  ];
  return (
    <header className="mb-8 space-y-3 rounded-xl bg-ink px-3 py-3 text-sm text-white">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin" className="px-1 font-display text-base font-bold uppercase tracking-wide">{t.adminArea}</Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-xs text-white/60 sm:inline">{admin.email}</span>
          <span className="shrink-0 text-xs text-white/60">{admin.role === "owner" ? t.roleOwner : t.roleAdmin}</span>
          <form action={logout}><button className="shrink-0 rounded-md border border-white/30 px-3 py-1 text-xs hover:bg-white/10">{t.logout}</button></form>
        </div>
      </div>
      <AdminNav items={items} />
    </header>
  );
}
