import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_ADDRESS, LEGAL_OWNER, SUPPORT_EMAIL, legalUpdatedLabel } from "@/lib/site";
import { intlTag } from "@/i18n/locale";
import { getLocale } from "@/i18n/server";
import { legalText } from "@/i18n/dict/legal-common";

/** Cornice comune delle pagine legali: titolo, data di aggiornamento, testo leggibile. */
export async function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const l = await getLocale();
  const t = legalText[l];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted"><Link href="/" className="underline hover:text-brand">{t.home}</Link> / {title}</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{t.lastUpdated} {legalUpdatedLabel(intlTag(l))}</p>
      {t.translationNote && (
        <p className="mt-4 rounded-md border border-current/20 px-3 py-2 text-sm italic text-muted">{t.translationNote}</p>
      )}
      <p className="mt-6">{intro}</p>
      <div className="mt-2 space-y-8 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}

/** Indirizzo di assistenza come link; se non è configurato, un'indicazione generica. */
export async function SupportLink() {
  if (SUPPORT_EMAIL) return <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-brand">{SUPPORT_EMAIL}</a>;
  const t = legalText[await getLocale()];
  return <>{t.supportFallback}</>;
}

/** «Chi gestisce il sito», con i dati di contatto disponibili. */
export async function OwnerLine() {
  const t = legalText[await getLocale()];
  return <>
    {LEGAL_OWNER ?? t.ownerFallback}{LEGAL_ADDRESS && <>, {LEGAL_ADDRESS}</>}
    {SUPPORT_EMAIL && <> (<SupportLink />)</>}
  </>;
}
