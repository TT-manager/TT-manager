"use server";
import { refresh } from "next/cache";
import { requireAccount } from "@/lib/account";
import { normalizeCode } from "@/lib/codes";
import { registrationIsOpen } from "@/lib/registration";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/action-form";
import { tr } from "@/i18n/server";
import { publicEnrollText } from "@/i18n/dict/public-tournament";

const UUID = /^[0-9a-f-]{36}$/i;

/** Torneo aperto alle iscrizioni + verifica che il giocatore sia della lega. */
async function load(formData: FormData) {
  const code = normalizeCode(String(formData.get("public_code") ?? ""));
  const account = await requireAccount(`/t/${code}`);
  const tx = await tr(publicEnrollText);
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments")
    .select("id, status, kind, championship_id, registration_open, registration_deadline").eq("public_code", code).maybeSingle();
  if (!t) return { error: tx.notFound } as const;
  if (!registrationIsOpen(t)) return { error: tx.closed } as const;
  const { data: m } = await svc.from("championship_players").select("player_id")
    .eq("championship_id", t.championship_id).eq("player_id", account.player.id).maybeSingle();
  if (!m) return { error: tx.mustBeMember } as const;
  return { svc, t, account, tx } as const;
}

export async function selfEnroll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await load(formData);
  if ("error" in ctx) return { error: ctx.error };
  const { svc, t, account, tx } = ctx;
  const me = account.player.id;
  const { data: mine } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", me).maybeSingle();
  if (mine) return { ok: tx.alreadyEnrolled };

  const partner = String(formData.get("partner_id") ?? "");
  if (t.kind === "doubles" && partner) {
    if (!UUID.test(partner) || partner === me) return { error: tx.invalidPartner };
    const { data: pm } = await svc.from("championship_players").select("player_id").eq("championship_id", t.championship_id).eq("player_id", partner).maybeSingle();
    if (!pm) return { error: tx.partnerNotMember };
    const { data: pe } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", partner).maybeSingle();
    if (pe) {
      // Il compagno è già iscritto: va bene solo se è da solo, e allora completiamo la sua coppia.
      const { count } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", pe.entry_id);
      if (count !== 1) return { error: tx.partnerTaken };
      const { error } = await svc.from("entry_members").insert({ entry_id: pe.entry_id, tournament_id: t.id, player_id: me });
      if (error) return { error: tx.enrollFailed };
      const { count: after } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", pe.entry_id);
      if ((after ?? 0) > 2) { // qualcun altro è stato più veloce
        await svc.from("entry_members").delete().eq("entry_id", pe.entry_id).eq("player_id", me);
        return { error: tx.partnerJustTaken };
      }
      refresh();
      return { ok: tx.pairComplete };
    }
  }
  const { data: entry, error: e1 } = await svc.from("tournament_entries").insert({ tournament_id: t.id }).select("id").single();
  if (e1 || !entry) return { error: tx.enrollFailed };
  const members = [me, ...(t.kind === "doubles" && partner ? [partner] : [])];
  const { error: e2 } = await svc.from("entry_members").insert(members.map((player_id) => ({ entry_id: entry.id, tournament_id: t.id, player_id })));
  if (e2) {
    await svc.from("tournament_entries").delete().eq("id", entry.id);
    return { error: tx.enrollConflict };
  }
  refresh();
  return { ok: t.kind === "doubles" ? (partner ? tx.enrolledPair : tx.enrolledSolo) : tx.enrolledOk };
}

export async function selfWithdraw(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await load(formData);
  if ("error" in ctx) return { error: ctx.error };
  const { svc, t, account, tx } = ctx;
  const { data: mine } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", account.player.id).maybeSingle();
  if (!mine) return { ok: tx.notEnrolled };
  await svc.from("entry_members").delete().eq("entry_id", mine.entry_id).eq("player_id", account.player.id);
  const { count } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", mine.entry_id);
  if (!count) await svc.from("tournament_entries").delete().eq("id", mine.entry_id);
  refresh();
  return { ok: count ? tx.withdrawnMateStays : tx.withdrawn };
}
