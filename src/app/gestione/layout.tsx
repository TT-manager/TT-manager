import { Suspense } from "react";
import { tr } from "@/i18n/server";
import { adminManageText } from "@/i18n/dict/admin-manage";

// Gestione di un torneo: per admin delle leghe e per chi ha creato un amichevole.
// I permessi sono verificati in ogni pagina e azione (requireTournamentManager).
export default function ManageLayout({ children }: LayoutProps<"/gestione">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Suspense fallback={null}><Badge /></Suspense>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </div>
  );
}

async function Badge() {
  return <p className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">{(await tr(adminManageText)).manageTournament}</p>;
}

async function Loading() {
  return <p>{(await tr(adminManageText)).loading}</p>;
}
