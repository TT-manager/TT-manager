import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_ADDRESS, LEGAL_OWNER, LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

/** Cornice comune delle pagine legali: titolo, data di aggiornamento, testo leggibile. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted"><Link href="/" className="underline hover:text-brand">Home</Link> / {title}</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Ultimo aggiornamento: {LEGAL_UPDATED}</p>
      <p className="mt-6">{intro}</p>
      <div className="mt-2 space-y-8 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}

/** Indirizzo di assistenza come link; se non è configurato, un'indicazione generica. */
export function SupportLink() {
  return SUPPORT_EMAIL
    ? <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-brand">{SUPPORT_EMAIL}</a>
    : <>l&apos;indirizzo di assistenza indicato nel sito</>;
}

/** «Chi gestisce il sito», con i dati di contatto disponibili. */
export function OwnerLine() {
  return <>
    {LEGAL_OWNER ?? "Il gestore del sito"}{LEGAL_ADDRESS && <>, {LEGAL_ADDRESS}</>}
    {SUPPORT_EMAIL && <> (<SupportLink />)</>}
  </>;
}
