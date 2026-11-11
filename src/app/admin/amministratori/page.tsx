import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { AddAdminForm, RemoveAdminButton } from "./forms";

export const metadata = { title: "Amministratori" };

export default async function AdminsPage() {
  const me = await requireOwner();
  if (!hasServiceKey()) return <p>Manca la configurazione del server (chiave segreta).</p>;
  const svc = createServiceClient();
  const { data: rows } = await svc.from("admins").select("user_id, role, created_at").order("created_at");
  const admins = await Promise.all((rows ?? []).map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id);
    return { ...r, email: data.user?.email ?? "(account eliminato)", lastSignIn: data.user?.last_sign_in_at ?? null };
  }));
  return (
    <main>
      <h1 className="text-2xl font-bold">Amministratori</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">Gli amministratori gestiscono giocatori, tornei e risultati. Solo il proprietario aggiunge o toglie amministratori.</p>
      <AddAdminForm />
      <ul className="mt-6 divide-y">
        {admins.map((a) => (
          <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>{a.email} <span className="text-sm text-neutral-600 dark:text-neutral-400">
              · {a.role === "owner" ? "proprietario" : "admin"} · {a.lastSignIn ? `ultimo accesso ${new Date(a.lastSignIn).toLocaleDateString("it-IT")}` : "mai entrato"}</span></span>
            {a.role !== "owner" && a.user_id !== me.userId && <RemoveAdminButton userId={a.user_id} email={a.email} />}
          </li>
        ))}
      </ul>
    </main>
  );
}
