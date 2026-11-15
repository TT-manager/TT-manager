import Link from "next/link";
import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_NAME } from "./logo";
import { tr } from "@/i18n/server";
import { layoutText } from "@/i18n/dict/layout";
import { logout } from "@/app/login/actions";
import { AccountMenu } from "./account-menu";

/** Barra in alto, uguale su tutte le pagine. */
export async function SiteHeader() {
  const t = await tr(layoutText);
  return (
    <header className="sticky top-0 z-30 border-b-4 border-brand bg-ink text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex items-center" aria-label={`${SITE_NAME}: ${t.homeAria}`}>
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
  const t = await tr(layoutText);
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const item = "rounded-md px-2 py-1.5 hover:bg-white/10";
  if (!data?.claims?.sub) return <>
    <Link href="/login" className={item}>{t.login}</Link>
    <Link href="/registrati" className="rounded-md bg-brand px-3 py-1.5 font-medium hover:bg-brand-dark">{t.signup}</Link>
  </>;
  const { data: admin } = await supabase.from("admins").select("role").eq("user_id", data.claims.sub).maybeSingle();
  const items = [
    { href: "/", label: t.home, icon: "home" as const },
    { href: "/profilo", label: t.myProfile, icon: "profile" as const },
    { href: "/amici", label: t.friends, icon: "friends" as const },
    { href: "/amichevole/nuovo", label: t.createFriendly, icon: "add" as const },
    ...(admin ? [{ href: "/admin", label: t.admin, icon: "admin" as const }] : []),
    { href: "/faq", label: t.faq, icon: "help" as const },
  ];
  return <AccountMenu items={items} logout={logout} logoutLabel={t.logout} menuLabel={t.menu} languageLabel={t.language} />;
}
