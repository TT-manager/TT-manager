import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Client anonimo, senza cookie né sessione: solo per leggere dati pubblici. */
export function createPublicClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
