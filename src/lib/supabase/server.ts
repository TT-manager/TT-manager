import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";
import { timedFetch } from "./timed-fetch";

/** Client legato ai cookie dell'utente che sta facendo la richiesta. */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: il rinnovo sessione lo fa proxy.ts.
        }
      },
    },
  });
}
