import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

/** «Il mio profilo» se collegato, altrimenti «Accedi · Registrati». Va dentro <Suspense>. */
export async function AccountLink() {
  const { data } = await (await createServerSupabase()).auth.getClaims();
  if (data?.claims?.sub) return <Link href="/profilo" className="hover:underline">Il mio profilo</Link>;
  return <span><Link href="/login" className="hover:underline">Accedi</Link> · <Link href="/registrati" className="hover:underline">Registrati</Link></span>;
}
