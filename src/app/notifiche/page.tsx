import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { requireAccount } from "@/lib/account";
import { emailPrefs, listNotifications } from "@/lib/notifications";
import { timeAgo } from "@/lib/time";
import { getLocale, tr } from "@/i18n/server";
import { notificationsText } from "@/i18n/dict/notifications";
import { deleteAllNotificationsAction, deleteNotificationAction } from "./actions";
import { MarkRead } from "./mark-read";
import { PushToggle } from "./push-toggle";
import { EmailToggle } from "./email-toggle";
import { pushPublicKey } from "@/lib/push";
import { Icon } from "@/components/icons";

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
  const pushKey = await pushPublicKey().catch(() => null);
  const now = new Date();
  return (
    <>
      <MarkRead unread={unread} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold uppercase">{t.title}</h1>
        {list.length > 0 && <ActionForm action={deleteAllNotificationsAction} submitLabel={t.deleteAll} confirmText={t.deleteAllConfirm} primary={false} inline />}
      </div>
      {list.length === 0 ? <p className="mt-4 text-muted">{t.empty}</p> : (
        <ul className="card mt-4 divide-y divide-line !py-1">
          {list.map((n) => (
            <li key={n.id} className="flex items-start gap-1">
              <Link href={n.href} className="flex min-w-0 flex-1 items-start gap-3 py-3 hover:text-brand">
                <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.read_at ? "" : "font-semibold"}`}>{t.text(n.kind, n.params)}</span>
                  <span className="text-xs text-muted">{timeAgo(n.created_at, now, l)}</span>
                </span>
              </Link>
              <form action={deleteNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <button aria-label={t.deleteOne} title={t.deleteOne}
                  className="mt-1.5 flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-brand/10 hover:text-brand"><Icon name="trash" className="h-4 w-4" /></button>
              </form>
            </li>))}
        </ul>)}

      {/* Impostazioni in fondo e chiuse: due interruttori, uno per il telefono e uno per le email. */}
      <details className="card mt-8 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
          <span>⚙ {t.settingsTitle}</span><span aria-hidden="true" className="text-muted">▾</span>
        </summary>
        <ul className="mt-3 divide-y divide-line">
          {pushKey && (
            <li className="flex items-start justify-between gap-4 py-3">
              <span className="min-w-0"><span className="block font-medium">{t.pushRow}</span><span className="text-xs text-muted">{t.pushRowHint}</span></span>
              <PushToggle publicKey={pushKey} />
            </li>)}
          <li className="flex items-start justify-between gap-4 py-3">
            <span className="min-w-0"><span className="block font-medium">{t.emailRow}</span><span className="text-xs text-muted">{t.emailRowHint}</span></span>
            <EmailToggle initial={prefs.email_tournaments} />
          </li>
        </ul>
      </details>
    </>
  );
}
