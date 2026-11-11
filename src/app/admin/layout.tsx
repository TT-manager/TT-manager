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
    <header className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-3">
      <Link href="/admin" className="font-bold">Amministrazione</Link>
      <Link href="/admin/giocatori" className="hover:underline">Giocatori</Link>
      <span className="ml-auto text-sm text-neutral-600 dark:text-neutral-400">
        {admin.email} ({admin.role === "owner" ? "proprietario" : "admin"})
      </span>
      <form action={logout}><button className="rounded border px-3 py-1 text-sm">Esci</button></form>
    </header>
  );
}
