"use client";
import { useState } from "react";
import { clubLabel, NEW_CLUB, type Club } from "@/lib/clubs";

/**
 * Menu dei circoli approvati. Con `allowRequest` c'è anche «Il mio circolo non è in elenco»,
 * che apre i campi per chiederne uno nuovo all'amministratore.
 */
export function ClubPicker({ clubs, defaultValue = "", allowRequest = false, className = "", label = "Circolo" }: {
  clubs: Club[]; defaultValue?: string; allowRequest?: boolean; className?: string; label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-2">
      <select name="club_id" value={value} onChange={(e) => setValue(e.target.value)} className={`select-arrow ${className}`} aria-label={label}>
        <option value="">Nessun circolo</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        {allowRequest && <option value={NEW_CLUB}>Il mio circolo non è in elenco…</option>}
      </select>
      {value === NEW_CLUB && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted">Scrivi il circolo: lo controlla l&apos;amministratore e, se lo approva, viene aggiunto al tuo profilo.</p>
          <input name="new_club_name" required minLength={2} maxLength={80} placeholder="Nome del circolo" aria-label="Nome del circolo" className={className} />
          <input name="new_club_city" maxLength={60} placeholder="Città (facoltativa)" aria-label="Città del circolo" className={className} />
        </div>)}
    </div>
  );
}
