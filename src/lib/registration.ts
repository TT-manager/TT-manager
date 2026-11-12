/** Le iscrizioni autonome sono possibili ora? */
export function registrationIsOpen(t: { status: string; registration_open: boolean; registration_deadline: string | null; championship_id: string | null }, now = new Date()) {
  return Boolean(t.championship_id) && t.status === "draft" && t.registration_open &&
    (!t.registration_deadline || now < new Date(t.registration_deadline));
}

export const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Istante → «2026-11-20T20:00» in ora italiana (per i campi data e ora). */
export function isoToRomeLocal(iso: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Converte «2026-11-20T20:00» (ora italiana) in un istante UTC. */
export function romeToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = new Date(`${local}:00Z`);
  const wall = new Date(asUtc.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const utcWall = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() - (wall.getTime() - utcWall.getTime())).toISOString();
}

