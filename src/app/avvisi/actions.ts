"use server";
import { refresh } from "next/cache";
import { requireChampionshipManager, requireTournamentManager } from "@/lib/auth";
import { hasServiceKey } from "@/lib/organizer";
import { deleteAnnouncement, postAnnouncement, type AnnouncementTarget } from "@/lib/announcements";
import { tr } from "@/i18n/server";
import { announcementsText } from "@/i18n/dict/announcements";
import type { ActionState } from "@/components/action-form";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Chi scrive deve gestire il circuito (amministratore del circuito o proprietario) o il torneo
 * (anche chi ha creato un amichevole). Restituisce l'autore e il destinatario, oppure null.
 */
async function authorize(formData: FormData): Promise<{ userId: string; target: AnnouncementTarget } | null> {
  const cid = String(formData.get("championship_id") ?? "");
  const tid = String(formData.get("tournament_id") ?? "");
  if (UUID.test(cid)) return { userId: (await requireChampionshipManager(cid)).userId, target: { championshipId: cid } };
  if (UUID.test(tid)) return { userId: (await requireTournamentManager(tid)).userId, target: { tournamentId: tid } };
  return null;
}

export async function postAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await tr(announcementsText);
  if (!hasServiceKey()) return { error: t.failed };
  const who = await authorize(formData);
  if (!who) return { error: t.failed };
  const body = String(formData.get("body") ?? "").trim().replace(/\n{3,}/g, "\n\n");
  if (!body) return { error: t.tooShort };
  if (body.length > 500) return { error: t.tooLong };
  const n = await postAnnouncement(who.target, body, who.userId);
  if (n === null) return { error: t.failed };
  refresh();
  return { ok: n ? t.sent(n) : t.sentNobody };
}

export async function deleteAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await tr(announcementsText);
  if (!hasServiceKey()) return { error: t.failed };
  const who = await authorize(formData);
  const id = String(formData.get("id") ?? "");
  if (!who || !/^\d{1,18}$/.test(id)) return { error: t.failed };
  await deleteAnnouncement(who.target, Number(id));
  refresh();
  return {};
}
