import { intlTag, type Locale } from "../i18n/locale";

/** «2 ore fa», «ieri», … (o in inglese) */
export function timeAgo(iso: string, now = new Date(), l: Locale = "it") {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(s / 3600), d = Math.floor(s / 86400);
  if (l === "en") {
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
    if (d === 1) return "yesterday";
    if (d < 7) return `${d} days ago`;
  } else {
    if (s < 60) return "adesso";
    if (s < 3600) return `${Math.floor(s / 60)} min fa`;
    if (s < 86400) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
    if (d === 1) return "ieri";
    if (d < 7) return `${d} giorni fa`;
  }
  return new Date(iso).toLocaleDateString(intlTag(l), { day: "numeric", month: "short" });
}
