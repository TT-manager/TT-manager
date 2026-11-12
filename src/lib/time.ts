/** «2 ore fa», «ieri», … */
export function timeAgo(iso: string, now = new Date()) {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "adesso";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${Math.floor(s / 3600) === 1 ? "ora" : "ore"} fa`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ieri";
  if (d < 7) return `${d} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
