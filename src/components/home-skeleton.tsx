"use client";
import { useTr } from "@/i18n/client";
import { compDashboard } from "@/i18n/dict/comp-dashboard";

/** Sagoma della home mentre arrivano i dati: stessa forma della pagina, senza la scritta «Caricamento». */
export function HomeSkeleton() {
  const t = useTr(compDashboard);
  const bar = "rounded-md bg-line";
  return (
    <div aria-busy="true" aria-label={t.loading} className="animate-pulse">
      <section className="relative overflow-hidden rounded-2xl bg-ink p-6 shadow-lg sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/90" />
        <div aria-hidden="true" className="absolute -right-4 top-24 h-24 w-24 rounded-full bg-brand/40" />
        <div className="relative space-y-3">
          <div className="h-10 w-2/3 max-w-sm rounded-md bg-white/15" />
          <div className="h-4 w-1/2 max-w-xs rounded-md bg-white/10" />
          <div className="h-10 w-full max-w-md rounded-lg bg-white/10" />
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-[6.5rem]"><div className={`h-3 w-20 ${bar}`} /><div className={`mt-3 h-8 w-12 ${bar}`} /></div>)}
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3"><div className={`h-7 w-56 ${bar}`} /><div className="card h-40" /><div className="card h-28" /></div>
        <div className="space-y-3"><div className={`h-7 w-40 ${bar}`} /><div className="card h-52" /></div>
      </div>
    </div>
  );
}

