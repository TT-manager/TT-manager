"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { runBackup } from "@/lib/backup";
import { hasEmail } from "@/lib/email";
import { sendWeeklyDigest } from "@/lib/weekly-digest";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export type BackupState = { error?: string; ok?: string };

/** Copia fatta a mano dal proprietario. */
export async function backupNowAction(): Promise<BackupState> {
  await requireOwner();
  const t = await tr(adminShellText);
  try {
    const r = await runBackup("manual");
    revalidatePath("/admin/backup");
    refresh();
    return { ok: t.backupDone(r.rows) };
  } catch (e) {
    console.error("Backup a mano non riuscito:", (e as Error).message);
    return { error: t.backupFailed };
  }
}

/** Manda subito il riepilogo settimanale al proprietario (per provarlo o per averlo prima del lunedì). */
export async function sendDigestNowAction(): Promise<BackupState> {
  await requireOwner();
  const t = await tr(adminShellText);
  if (!hasEmail()) return { error: t.digestNoKey };
  const r = await sendWeeklyDigest();
  if (!r.ok) { console.error("Riepilogo non inviato:", r.error); return { error: t.digestFailed }; }
  return { ok: t.digestSent };
}
