"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/account";
import { answerChallenge, answerResult, createChallenge, reportChallenge } from "@/lib/challenges";
import { setsFromForm } from "@/lib/domain/score";
import type { ActionState } from "@/components/action-form";
import type { ResultState } from "@/components/match-form";
import { getLocale } from "@/i18n/server";
import { translateDomainError } from "@/i18n/domain-errors";

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Aggiorna le pagine che mostrano le sfide (home, lega, scheda giocatore). */
function updated() {
  revalidatePath("/", "layout");
  refresh();
}

export async function sendChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount(field(formData, "back") || "/");
  const r = await createChallenge(field(formData, "championship_id"), account.player.id, field(formData, "opponent_id"), Number(field(formData, "best_of")));
  if (r.ok) updated();
  return r;
}

export async function answerChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/");
  const answer = field(formData, "answer");
  if (answer !== "accept" && answer !== "decline" && answer !== "cancel") return {};
  const r = await answerChallenge(field(formData, "challenge_id"), account.player.id, answer);
  if (r.ok) updated();
  return { error: r.error, ok: r.ok };
}

export async function reportChallengeAction(_prev: ResultState, formData: FormData): Promise<ResultState> {
  const account = await requireAccount("/");
  const sets = setsFromForm(formData);
  if ("error" in sets) return { error: translateDomainError(sets.error, await getLocale()), set: sets.set };
  const r = await reportChallenge(field(formData, "match_id"), account.player.id, sets);
  if (r.ok) updated();
  return { error: r.error, ok: r.ok, set: r.set };
}

export async function answerResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/");
  const answer = field(formData, "answer");
  if (answer !== "confirm" && answer !== "dispute") return {};
  const r = await answerResult(field(formData, "challenge_id"), account.player.id, answer);
  if (r.ok) updated();
  return { error: r.error, ok: r.ok };
}
