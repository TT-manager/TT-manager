import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Chiamata una volta al giorno da Vercel (vedi vercel.json): fa una lettura minima al database
 * così il progetto Supabase gratuito non va in pausa per inattività nei periodi in cui il sito è fermo.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { error } = await createPublicClient()
    .from("tournaments_public").select("id", { count: "exact", head: true });
  return Response.json({ ok: !error }, { status: error ? 500 : 200 });
}
