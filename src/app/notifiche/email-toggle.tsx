"use client";
import { useState } from "react";
import { Switch } from "@/components/switch";
import { setEmailTournaments } from "./actions";
import { useTr } from "@/i18n/client";
import { notificationsText } from "@/i18n/dict/notifications";

/** Interruttore delle email per i nuovi tornei: si salva appena lo tocchi, senza il pulsante «Salva». */
export function EmailToggle({ initial }: { initial: boolean }) {
  const t = useTr(notificationsText);
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function change(next: boolean) {
    setOn(next); setBusy(true); setError(false);
    try { await setEmailTournaments(next); } catch { setOn(!next); setError(true); } finally { setBusy(false); }
  }
  return (
    <div>
      <Switch on={on} onChange={change} disabled={busy} label={t.emailRow} />
      {error && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">{t.pushError}</p>}
    </div>
  );
}
