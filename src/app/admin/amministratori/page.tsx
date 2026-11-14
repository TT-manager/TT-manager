import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { AddAdminForm, RemoveAdminButton } from "./forms";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).adminsTitle };
}

export default async function AdminsPage() {
  const me = await requireOwner();
  const t = await tr(adminShellText);
  const l = await getLocale();
  if (!hasServiceKey()) return <p>{t.missingServiceKey}</p>;
  const svc = createServiceClient();
  const { data: rows } = await svc.from("admins").select("user_id, role, created_at").order("created_at");
  const admins = await Promise.all((rows ?? []).map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id);
    return { ...r, email: data.user?.email ?? t.deletedAccount, lastSignIn: data.user?.last_sign_in_at ?? null };
  }));
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.adminsTitle}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t.adminsIntro}</p>
      <AddAdminForm />
      <ul className="mt-6 divide-y">
        {admins.map((a) => (
          <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>{a.email} <span className="text-sm text-neutral-600 dark:text-neutral-400">
              · {a.role === "owner" ? t.roleOwner : t.roleAdmin} · {a.lastSignIn ? t.lastSignIn(new Date(a.lastSignIn).toLocaleDateString(intlTag(l))) : t.neverSignedIn}</span></span>
            {a.role !== "owner" && a.user_id !== me.userId && <RemoveAdminButton userId={a.user_id} email={a.email} />}
          </li>
        ))}
      </ul>
    </main>
  );
}
