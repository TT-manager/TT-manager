import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

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
  return <p>{(await tr(adminShellText)).loading}</p>;
}

async function Header() {
  const t = await tr(adminShellText);
  const admin = await requireAdmin(); // controllo sul database a ogni richiesta
  const { count: pendingClubs } = admin.role === "owner"
    ? await (await createServerSupabase()).from("club_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
    : { count: 0 };
  return (
    <header className="mb-8 flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-ink px-3 py-2 text-sm text-white">
      <Link href="/admin" className="mr-2 rounded-md px-2 py-1 font-display text-base font-bold uppercase tracking-wide">{t.adminArea}</Link>
      <Link href="/admin/campionati" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navLeagues}</Link>
      <Link href="/admin/tornei" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navTournaments}</Link>
      <Link href="/admin/giocatori" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navPlayers}</Link>
      {admin.role === "owner" && <Link href="/admin/circoli" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navClubs}{pendingClubs ? <span className="ml-1 rounded-full bg-brand px-1.5 text-xs">{pendingClubs}</span> : null}</Link>}
      {admin.role === "owner" && <Link href="/admin/amministratori" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navAdmins}</Link>}
      <Link href="/admin/password" className="rounded-md px-2 py-1 hover:bg-white/10">{t.navPassword}</Link>
      <span className="ml-auto text-xs text-white/60">{admin.email} ({admin.role === "owner" ? t.roleOwner : t.roleAdmin})</span>
      <form action={logout}><button className="rounded-md border border-white/30 px-3 py-1 text-xs hover:bg-white/10">{t.logout}</button></form>
    </header>
  );
}
