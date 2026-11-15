import { connection } from "next/server";
import { runBackup } from "@/lib/backup";

/**
 * Copia notturna del database, avviata da Vercel (vedi vercel.json). Non restituisce dati:
 * chiamarla di nuovo crea solo un'altra copia nell'archivio privato.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const r = await runBackup("daily");
    return Response.json({ ok: true, rows: r.rows });
  } catch (e) {
    console.error("Backup non riuscito:", (e as Error).message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
