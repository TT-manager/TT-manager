import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITE_NAME } from "./logo";
import { SUPPORT_EMAIL } from "@/lib/site";
import { tr } from "@/i18n/server";
import { layoutText } from "@/i18n/dict/layout";
import { LanguageSwitch } from "./language-switch";

const link = "rounded px-1 -mx-1 py-0.5 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand";
const heading = "font-display text-sm font-semibold uppercase tracking-wider text-foreground";

/** Accedi/Registrati per chi non è collegato; profilo ed Esci per chi lo è. */
async function AccountLinks() {
  const t = await tr(layoutText);
  const { data } = await (await createServerSupabase()).auth.getClaims();
  if (!data?.claims?.sub) return <>
    <li><Link href="/login" className={link}>{t.login}</Link></li>
    <li><Link href="/registrati" className={link}>{t.signup}</Link></li>
  </>;
  return <>
    <li><Link href="/profilo" className={link}>{t.myProfile}</Link></li>
    <li><form action={logout}><button className={`${link} cursor-pointer text-left`}>{t.logout}</button></form></li>
  </>;
}

/** Piè di pagina, uguale su tutte le pagine, con il selettore della lingua. */
export async function SiteFooter() {
  const t = await tr(layoutText);
  return (
    <footer className="mt-16 border-t-4 border-ink bg-surface text-sm text-muted">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-xl font-bold uppercase text-foreground">{SITE_NAME}</p>
          <p className="mt-2 max-w-sm">{t.footerTagline}</p>
          <div className="mt-4"><LanguageSwitch label={t.language} /></div>
        </div>

        <nav aria-label={t.theSite}>
          <h2 className={heading}>{t.theSite}</h2>
          <ul className="mt-3 space-y-1.5">
            <li><Link href="/" className={link}>{t.home}</Link></li>
            <li><Link href="/faq" className={link}>{t.faq}</Link></li>
            <Suspense fallback={null}><AccountLinks /></Suspense>
          </ul>
        </nav>

        <nav aria-label={t.legal}>
          <h2 className={heading}>{t.legal}</h2>
          <ul className="mt-3 space-y-1.5">
            {SUPPORT_EMAIL && <li><a href={`mailto:${SUPPORT_EMAIL}`} className={link}>{SUPPORT_EMAIL}</a></li>}
            <li><Link href="/privacy" className={link}>{t.privacy}</Link></li>
            <li><Link href="/termini" className={link}>{t.terms}</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:justify-between">
          <p>© {SITE_NAME}. {t.rights}</p>
          <p>{t.cookies}</p>
        </div>
      </div>
    </footer>
  );
}
