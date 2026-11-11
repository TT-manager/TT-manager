import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";

export const metadata = { title: "Amministrazione" };

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<p>Caricamento…</p>}><Content /></Suspense>
    </main>
  );
}

async function Content() {
  const admin = await requireAdmin();
  return (
    <>
      <h1 className="text-2xl font-bold">Amministrazione</h1>
      <p className="mt-2 text-neutral-600">Connesso come {admin.email} ({admin.role === "owner" ? "proprietario" : "admin"}).</p>
      <p className="mt-6">Giocatori, tornei e admin: in arrivo.</p>
      <form action={logout} className="mt-6"><button className="rounded border px-4 py-2">Esci</button></form>
    </>
  );
}
