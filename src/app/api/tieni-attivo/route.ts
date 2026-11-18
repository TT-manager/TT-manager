import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { hasEmail } from "@/lib/email";
import { sendWeeklyDigest } from "@/lib/weekly-digest";
import { pruneNotifications } from "@/lib/notifications";

/**
 * Chiamata una volta al giorno da Vercel (vedi vercel.json):
 * - fa una lettura minima al database, così il progetto Supabase gratuito non va in pausa per inattività;
 * - il lunedì manda al proprietario il riepilogo settimanale (che tiene anche attiva la chiave di Brevo).
 * Il riepilogo parte solo se la chiamata porta il segreto CRON_SECRET: senza, nessuno da fuori può farlo partire.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (secret && !authorized) return Response.json({ ok: false }, { status: 401 });
  const { error } = await createPublicClient()
    .from("tournaments_public").select("id", { count: "exact", head: true });
  // Avvisi vecchi (oltre 90 giorni): via.
  if (authorized) await pruneNotifications().catch((e) => console.error("Pulizia notifiche:", (e as Error).message));
  const monday = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Rome", weekday: "short" }) === "Mon";
  let digest: string = "non è lunedì";
  if (monday) {
    if (!authorized) digest = "saltato: manca CRON_SECRET";
    else if (!hasEmail()) digest = "saltato: manca BREVO_API_KEY";
    else {
      const r = await sendWeeklyDigest();
      digest = r.ok ? "inviato" : "non inviato";
      if (!r.ok) console.error("Riepilogo settimanale non inviato:", r.error);
    }
  }
  return Response.json({ ok: !error, digest }, { status: error ? 500 : 200 });
}
