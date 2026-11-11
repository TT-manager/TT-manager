import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Client con la chiave segreta: aggira la RLS. Usare SOLO nel server
 * (server action / route handler) e solo dopo aver verificato chi chiama
 * (utente admin oppure codice organizzatore).
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY non configurata");
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
