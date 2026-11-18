import { requireOwner } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { listBackups } from "@/lib/backup";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminShellText } from "@/i18n/dict/admin-shell";
import { BackupNowButton, SendDigestButton } from "./forms";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).backupTitle };
}

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function BackupPage() {
  await requireOwner();
  const t = await tr(adminShellText);
  const l = await getLocale();
  if (!hasServiceKey()) return <p>{t.missingServiceKey}</p>;
  const copies = await listBackups();
  const when = (iso: string) => new Date(iso).toLocaleString(intlTag(l), {
    timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.backupTitle}</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t.backupIntro}</p>
        <p className="mt-2 text-sm font-semibold">{t.backupAdvice}</p>
      </div>
      <BackupNowButton />
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">{t.digestTitle}</h2>
        <p className="text-sm text-muted">{t.digestIntro}</p>
        <SendDigestButton />
      </section>
      <section className="card">
        <p className="text-sm text-muted">{t.backupCount(copies.length)}</p>
        {copies.length === 0 ? <p className="mt-2">{t.backupNone}</p> : (
          <ul className="mt-2 divide-y divide-line">
            {copies.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-semibold">{c.createdAt ? when(c.createdAt) : c.name}</span>
                  <span className="text-sm text-muted">{c.kind === "daily" ? t.backupDaily : t.backupManual} · {size(c.size)}</span>
                </span>
                <a href={`/admin/backup/scarica?f=${encodeURIComponent(c.name)}`} download className="btn-outline shrink-0">{t.backupDownload}</a>
              </li>))}
          </ul>)}
      </section>
    </main>
  );
}
