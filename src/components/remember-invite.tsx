"use client";
import { useEffect } from "react";

/** Si segna l'invito nel browser (30 giorni), così non si perde se la registrazione continua altrove. */
export function RememberInvite({ slug, token }: { slug: string; token: string }) {
  useEffect(() => {
    document.cookie = `pf_invito=${encodeURIComponent(JSON.stringify({ slug, token }))}; path=/; max-age=${30 * 86400}; samesite=lax`;
  }, [slug, token]);
  return null;
}
