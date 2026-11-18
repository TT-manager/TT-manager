import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { requireAccount } from "@/lib/account";
import { emailPrefs, listNotifications } from "@/lib/notifications";
import { timeAgo } from "@/lib/time";
import { getLocale, tr } from "@/i18n/server";
import { notificationsText } from "@/i18n/dict/notifications";
import { saveEmailPrefs } from "./actions";
import { MarkRead } from "./mark-read";

export async function generateMetadata() {
  return { title: (await tr(notificationsText)).title };
}

export default function NotificationsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Suspense fallback={<p data-loading className="text-muted">…</p>}><Notifications /></Suspense>
    </main>
  );
}

async function Notifications() {
  const account = await requireAccount("/notifiche");
  const [t, l, list, prefs] = [await tr(notificationsText), await getLocale(), await listNotifications(account.userId), await emailPrefs(account.userId)];
  const unread = list.filter((n) => !n.read_at).length;
  const now = new Date();
  return (
    <>
      <MarkRead unread={unread} />
      <h1 className="text-3xl font-bold uppercase">{t.title}</h1>
      {list.length === 0 ? <p className="mt-4 text-muted">{t.empty}</p> : (
        <ul className="card mt-4 divide-y divide-line !py-1">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex items-start gap-3 py-3 hover:text-brand">
                <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.read_at ? "" : "font-semibold"}`}>{t.text(n.kind, n.params)}</span>
                  <span className="text-xs text-muted">{timeAgo(n.created_at, now, l)}</span>
                </span>
              </Link>
            </li>))}
        </ul>)}

      <section className="card mt-8">
        <h2 className="text-lg font-semibold">{t.emailTitle}</h2>
        <ActionForm action={saveEmailPrefs} submitLabel={t.save} primary={false} className="mt-3 space-y-3">
          <label className="flex items-start gap-2"><input type="checkbox" name="email_tournaments" defaultChecked={prefs.email_tournaments} className="mt-1" /> {t.emailTournaments}</label>
        </ActionForm>
      </section>
    </>
  );
}
