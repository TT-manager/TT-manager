import Link from "next/link";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).adminArea };
}

export default async function AdminHome() {
  const t = await tr(adminShellText);
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.homeTitle}</h1>
      <ul className="mt-4 space-y-2">
        <li><Link href="/admin/campionati" className="underline">{t.homeLeagues}</Link></li>
        <li><Link href="/admin/giocatori" className="underline">{t.homePlayers}</Link></li>
        <li><Link href="/admin/tornei" className="underline">{t.homeTournaments}</Link></li>
        <li><Link href="/admin/circoli" className="underline">{t.homeClubs}</Link> {t.ownerOnly}</li>
        <li><Link href="/admin/amministratori" className="underline">{t.homeAdmins}</Link> {t.ownerOnly}</li>
        <li><Link href="/admin/password" className="underline">{t.homePassword}</Link></li>
      </ul>
    </main>
  );
}
