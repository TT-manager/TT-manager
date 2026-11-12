import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Suspense fallback={<p>Caricamento…</p>}>
        <Header />
        {children}
      </Suspense>
    </div>
  );
}

async function Header() {
  const admin = await requireAdmin(); // controllo sul database a ogni richiesta
  return (
    <header className="mb-8 flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-ink px-3 py-2 text-sm text-white">
      <Link href="/admin" className="mr-2 rounded-md px-2 py-1 font-display text-base font-bold uppercase tracking-wide">Amministrazione</Link>
      <Link href="/admin/campionati" className="rounded-md px-2 py-1 hover:bg-white/10">Campionati</Link>
      <Link href="/admin/tornei" className="rounded-md px-2 py-1 hover:bg-white/10">Tornei</Link>
      <Link href="/admin/giocatori" className="rounded-md px-2 py-1 hover:bg-white/10">Giocatori</Link>
      {admin.role === "owner" && <Link href="/admin/amministratori" className="rounded-md px-2 py-1 hover:bg-white/10">Amministratori</Link>}
      <Link href="/admin/password" className="rounded-md px-2 py-1 hover:bg-white/10">Password</Link>
      <span className="ml-auto text-xs text-white/60">{admin.email} ({admin.role === "owner" ? "proprietario" : "admin"})</span>
      <form action={logout}><button className="rounded-md border border-white/30 px-3 py-1 text-xs hover:bg-white/10">Esci</button></form>
    </header>
  );
}
