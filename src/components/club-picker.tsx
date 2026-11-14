"use client";
import { useState } from "react";
import { clubLabel, NEW_CLUB, type Club } from "@/lib/clubs";
import { useTr } from "@/i18n/client";
import { compCommon } from "@/i18n/dict/comp-common";

/**
 * Menu dei circoli approvati. Con `allowRequest` c'è anche «Il mio circolo non è in elenco»,
 * che apre i campi per chiederne uno nuovo all'amministratore.
 */
export function ClubPicker({ clubs, defaultValue = "", allowRequest = false, className = "", label }: {
  clubs: Club[]; defaultValue?: string; allowRequest?: boolean; className?: string; label?: string;
}) {
  const t = useTr(compCommon);
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-2">
      <select name="club_id" value={value} onChange={(e) => setValue(e.target.value)} className={`select-arrow ${className}`} aria-label={label ?? t.club}>
        <option value="">{t.noClub}</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        {allowRequest && <option value={NEW_CLUB}>{t.clubNotListed}</option>}
      </select>
      {value === NEW_CLUB && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted">{t.newClubHelp}</p>
          <input name="new_club_name" required minLength={2} maxLength={80} placeholder={t.clubName} aria-label={t.clubName} className={className} />
          <input name="new_club_city" maxLength={60} placeholder={t.clubCity} aria-label={t.clubCityAria} className={className} />
        </div>)}
    </div>
  );
}
