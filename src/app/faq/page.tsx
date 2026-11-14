import { tr, getLocale } from "@/i18n/server";
import { FAQ_SECTIONS, publicFaqText } from "@/i18n/dict/public-faq";

export async function generateMetadata() {
  const t = await tr(publicFaqText);
  return { title: t.title, description: t.description };
}

export default async function FaqPage() {
  const t = await tr(publicFaqText);
  const SECTIONS = FAQ_SECTIONS[await getLocale()];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold uppercase">{t.title}</h1>
      <p className="mt-2 text-muted">{t.intro}</p>
      <nav aria-label={t.topics} className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s, i) => <a key={s.title} href={`#s${i}`} className="badge-muted hover:text-brand">{s.title}</a>)}
      </nav>
      {SECTIONS.map((s, i) => (
        <section key={s.title} id={`s${i}`} className="mt-10 scroll-mt-24">
          <h2 className="text-2xl font-bold uppercase">{s.title}</h2>
          <div className="card mt-3 divide-y divide-line !py-1">
            {s.items.map((x) => (
              <details key={x.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {x.q}<span aria-hidden="true" className="text-muted transition group-open:rotate-90">›</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{x.a}</p>
              </details>))}
          </div>
        </section>))}
    </main>
  );
}
