"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/account";
import { normalizeCode } from "@/lib/codes";
import { hasServiceKey } from "@/lib/organizer";
import { contestResult, playerSaveResult, setsFromForm } from "@/lib/results";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ResultState } from "@/components/match-form";
import { tr } from "@/i18n/server";
import { publicOrganizerText } from "@/i18n/dict/public-tournament";

/** Torneo dal codice pubblico + giocatore collegato. I controlli su chi gioca la partita sono in lib/results. */
async function context(formData: FormData) {
  const code = normalizeCode(String(formData.get("public_code") ?? ""));
  const account = await requireAccount(`/t/${code}`);
  const tx = await tr(publicOrganizerText);
  if (!hasServiceKey()) return { error: tx.missingConfig } as const;
  const { data: t } = await createServiceClient().from("tournaments").select("id").eq("public_code", code).maybeSingle();
  if (!t) return { error: tx.notFound } as const;
  return { code, tournamentId: t.id as string, playerId: account.player.id } as const;
}

export async function playerSubmitResult(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const ctx = await context(formData);
  if ("error" in ctx) return { error: ctx.error };
  const clear = formData.get("intent") === "clear";
  const sets = clear ? null : setsFromForm(formData);
  if (sets && "error" in sets) return { error: sets.error, set: sets.set };
  const r = await playerSaveResult(ctx.tournamentId, String(formData.get("match_id") ?? ""), sets, ctx.playerId);
  if (r.ok) { revalidatePath(`/t/${ctx.code}`); refresh(); }
  return r;
}

export async function playerContestResult(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const ctx = await context(formData);
  if ("error" in ctx) return { error: ctx.error };
  const r = await contestResult(ctx.tournamentId, String(formData.get("match_id") ?? ""), ctx.playerId);
  if (r.ok) { revalidatePath(`/t/${ctx.code}`); refresh(); }
  return r;
}
