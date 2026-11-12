export type Club = { id: string; name: string; city: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NEW_CLUB = "nuovo";

export type ClubChoice =
  | { kind: "none" }
  | { kind: "existing"; clubId: string }
  | { kind: "request"; name: string; city: string | null };

/** Legge la scelta del circolo da un modulo: nessuno, uno dell'elenco, o la richiesta di uno nuovo. */
export function parseClubChoice(get: (key: string) => unknown, allowRequest = true): ClubChoice | { error: string } {
  const raw = String(get("club_id") ?? "").trim();
  if (!raw) return { kind: "none" };
  if (raw === NEW_CLUB) {
    if (!allowRequest) return { error: "Scegli un circolo dall'elenco." };
    const name = String(get("new_club_name") ?? "").trim().replace(/\s+/g, " ");
    const city = String(get("new_club_city") ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) return { error: "Scrivi il nome del circolo (2-80 caratteri)." };
    if (city.length > 60) return { error: "Nome della città troppo lungo." };
    return { kind: "request", name, city: city || null };
  }
  if (!UUID.test(raw)) return { error: "Circolo non valido." };
  return { kind: "existing", clubId: raw };
}

/** Nome da mostrare nell'elenco: «Nome (Città)». */
export function clubLabel(c: Club) {
  return c.city ? `${c.name} (${c.city})` : c.name;
}
