import "server-only";
import { createServiceClient } from "./supabase/admin";

/**
 * Copie del database: tutte le tabelle del sito (tranne le sessioni temporanee degli organizzatori)
 * e l'elenco degli account, in un file JSON nell'archivio privato «backups» di Supabase.
 * Le password non sono incluse (Supabase non le consegna). Si tengono le ultime KEEP copie.
 */
export const BACKUP_BUCKET = "backups";
/** Copie tenute: una al giorno per 30 giorni, più le ultime 10 fatte a mano. */
const KEEP = { daily: 30, manual: 10 } as const;

/** Tabelle copiate. Una tabella nuova va aggiunta qui. */
export const BACKUP_TABLES = [
  "admins", "championships", "championship_admins", "championship_players", "championship_invites", "championship_requests",
  "clubs", "club_requests", "players", "friendships", "player_absences", "past_tournaments", "past_results",
  "tournaments", "tournament_entries", "entry_members", "matches", "challenges", "rating_history",
] as const;

type Svc = ReturnType<typeof createServiceClient>;

async function allRows(svc: Svc, table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function allUsers(svc: Svc) {
  const users: unknown[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`account: ${error.message}`);
    users.push(...data.users.map((u) => ({
      id: u.id, email: u.email, created_at: u.created_at, email_confirmed_at: u.email_confirmed_at, user_metadata: u.user_metadata,
    })));
    if (data.users.length < 1000) return users;
  }
}

/**
 * Fa una copia adesso. Quella notturna (`daily`) è un solo file al giorno: richiamarla lo stesso giorno
 * lo sovrascrive, così nessuno può far sparire le copie dei giorni prima chiamandola di continuo.
 */
export async function runBackup(kind: "daily" | "manual"): Promise<{ file: string; rows: number }> {
  const svc = createServiceClient();
  const entries = await Promise.all(BACKUP_TABLES.map(async (t) => [t, await allRows(svc, t)] as const));
  const tables = Object.fromEntries(entries);
  const now = new Date();
  const body = JSON.stringify({ version: 1, created_at: now.toISOString(), tables, auth_users: await allUsers(svc) });
  // Nomi ordinabili per data, in ora UTC: giornaliera-2026-11-15.json, manuale-2026-11-15_17-20.json
  const file = kind === "daily"
    ? `giornaliera-${now.toISOString().slice(0, 10)}.json`
    : `manuale-${now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-")}.json`;
  const { error } = await svc.storage.from(BACKUP_BUCKET).upload(file, body, { contentType: "application/json", upsert: true });
  if (error) throw new Error(`archivio: ${error.message}`);
  // Si tengono solo le ultime copie.
  const list = await listBackups();
  const old = [
    ...list.filter((b) => b.kind === "daily").slice(KEEP.daily),
    ...list.filter((b) => b.kind === "manual").slice(KEEP.manual),
  ].map((b) => b.name);
  if (old.length) await svc.storage.from(BACKUP_BUCKET).remove(old);
  return { file, rows: entries.reduce((n, [, r]) => n + r.length, 0) };
}

/** Copie presenti, dalla più recente. */
export async function listBackups(): Promise<{ name: string; kind: "daily" | "manual"; size: number; createdAt: string }[]> {
  const { data } = await createServiceClient().storage.from(BACKUP_BUCKET).list("", { limit: 200 });
  return (data ?? []).filter((f) => f.name.endsWith(".json"))
    .map((f) => ({
      name: f.name, kind: f.name.startsWith("manuale-") ? "manual" as const : "daily" as const,
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0), createdAt: f.updated_at ?? f.created_at ?? "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Collegamento temporaneo (10 minuti) per scaricare una copia. */
export async function backupDownloadUrl(name: string) {
  const { data } = await createServiceClient().storage.from(BACKUP_BUCKET).createSignedUrl(name, 600, { download: name });
  return data?.signedUrl ?? null;
}
