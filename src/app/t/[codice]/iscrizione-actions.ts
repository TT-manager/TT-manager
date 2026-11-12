"use server";
import { refresh } from "next/cache";
import { requireAccount } from "@/lib/account";
import { normalizeCode } from "@/lib/codes";
import { registrationIsOpen } from "@/lib/registration";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/action-form";

const UUID = /^[0-9a-f-]{36}$/i;

/** Torneo aperto alle iscrizioni + verifica che il giocatore sia del campionato. */
async function load(formData: FormData) {
  const code = normalizeCode(String(formData.get("public_code") ?? ""));
  const account = await requireAccount(`/t/${code}`);
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments")
    .select("id, status, kind, championship_id, registration_open, registration_deadline").eq("public_code", code).maybeSingle();
  if (!t) return { error: "Torneo non trovato." } as const;
  if (!registrationIsOpen(t)) return { error: "Le iscrizioni a questo torneo sono chiuse." } as const;
  const { data: m } = await svc.from("championship_players").select("player_id")
    .eq("championship_id", t.championship_id).eq("player_id", account.player.id).maybeSingle();
  if (!m) return { error: "Per iscriverti devi far parte del campionato." } as const;
  return { svc, t, account } as const;
}

export async function selfEnroll(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await load(formData);
  if ("error" in ctx) return { error: ctx.error };
  const { svc, t, account } = ctx;
  const me = account.player.id;
  const { data: mine } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", me).maybeSingle();
  if (mine) return { ok: "Sei già iscritto." };

  const partner = String(formData.get("partner_id") ?? "");
  if (t.kind === "doubles" && partner) {
    if (!UUID.test(partner) || partner === me) return { error: "Scegli un compagno valido." };
    const { data: pm } = await svc.from("championship_players").select("player_id").eq("championship_id", t.championship_id).eq("player_id", partner).maybeSingle();
    if (!pm) return { error: "Il compagno deve far parte del campionato." };
    const { data: pe } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", partner).maybeSingle();
    if (pe) {
      // Il compagno è già iscritto: va bene solo se è da solo, e allora completiamo la sua coppia.
      const { count } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", pe.entry_id);
      if (count !== 1) return { error: "Il compagno che hai scelto è già in un'altra coppia." };
      const { error } = await svc.from("entry_members").insert({ entry_id: pe.entry_id, tournament_id: t.id, player_id: me });
      if (error) return { error: "Non sono riuscito a iscriverti: riprova." };
      const { count: after } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", pe.entry_id);
      if ((after ?? 0) > 2) { // qualcun altro è stato più veloce
        await svc.from("entry_members").delete().eq("entry_id", pe.entry_id).eq("player_id", me);
        return { error: "Il compagno che hai scelto è appena stato preso da un'altra coppia." };
      }
      refresh();
      return { ok: "Iscritto: la tua coppia è completa." };
    }
  }
  const { data: entry, error: e1 } = await svc.from("tournament_entries").insert({ tournament_id: t.id }).select("id").single();
  if (e1 || !entry) return { error: "Non sono riuscito a iscriverti: riprova." };
  const members = [me, ...(t.kind === "doubles" && partner ? [partner] : [])];
  const { error: e2 } = await svc.from("entry_members").insert(members.map((player_id) => ({ entry_id: entry.id, tournament_id: t.id, player_id })));
  if (e2) {
    await svc.from("tournament_entries").delete().eq("id", entry.id);
    return { error: "Non sono riuscito a iscriverti (forse ti sei appena iscritto o il compagno è già in coppia): ricarica la pagina." };
  }
  refresh();
  return { ok: t.kind === "doubles" ? (partner ? "Iscritti come coppia." : "Iscritto da solo: l'organizzatore ti abbinerà a un compagno.") : "Iscritto!" };
}

export async function selfWithdraw(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await load(formData);
  if ("error" in ctx) return { error: ctx.error };
  const { svc, t, account } = ctx;
  const { data: mine } = await svc.from("entry_members").select("entry_id").eq("tournament_id", t.id).eq("player_id", account.player.id).maybeSingle();
  if (!mine) return { ok: "Non sei iscritto." };
  await svc.from("entry_members").delete().eq("entry_id", mine.entry_id).eq("player_id", account.player.id);
  const { count } = await svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("entry_id", mine.entry_id);
  if (!count) await svc.from("tournament_entries").delete().eq("id", mine.entry_id);
  refresh();
  return { ok: count ? "Ritirato: il tuo compagno resta iscritto da solo." : "Ritirato." };
}
