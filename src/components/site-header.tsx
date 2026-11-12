import Link from "next/link";
import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_NAME } from "./logo";

/** Barra in alto, uguale su tutte le pagine. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-4 border-brand bg-ink text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex items-center" aria-label={`${SITE_NAME}: home`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo vettoriale, nessuna ottimizzazione necessaria */}
          <img src="/logo-scuro.svg" alt={SITE_NAME} width={151} height={40} className="h-10 w-auto" />
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-3">
          <Suspense fallback={null}><AccountNav /></Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountNav() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const item = "rounded-md px-2 py-1.5 hover:bg-white/10";
  if (!data?.claims?.sub) return <>
    <Link href="/login" className={item}>Accedi</Link>
    <Link href="/registrati" className="rounded-md bg-brand px-3 py-1.5 font-medium hover:bg-brand-dark">Registrati</Link>
  </>;
  const { data: admin } = await supabase.from("admins").select("role").eq("user_id", data.claims.sub).maybeSingle();
  return <>
    <Link href="/" className={`${item} hidden sm:inline`}>Home</Link>
    <Link href="/amici" className={`${item} hidden sm:inline`}>Amici</Link>
    {admin && <Link href="/admin" className={item}>Admin</Link>}
    <Link href="/profilo" className="rounded-md bg-brand px-3 py-1.5 font-medium hover:bg-brand-dark"><span className="sm:hidden">Profilo</span><span className="hidden sm:inline">Il mio profilo</span></Link>
  </>;
}
