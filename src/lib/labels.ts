import type { Locale } from "../i18n/locale";

export const STATUS_LABEL: Record<string, string> = {
  draft: "In preparazione", groups: "Gironi in corso", knockout: "Tabellone in corso", closed: "Chiuso",
};
const STATUS_LABEL_EN: Record<string, string> = {
  draft: "In preparation", groups: "Group stage", knockout: "Knockout stage", closed: "Closed",
};
/** Stato del torneo nella lingua indicata. */
export const statusLabel = (status: string, l: Locale = "it") => (l === "en" ? STATUS_LABEL_EN : STATUS_LABEL)[status] ?? status;

/** Nome dei punti della lega da mostrare: quello di base («Punti») diventa «Points» in inglese; un nome scelto dall'amministratore resta com'è. */
export const pointsLabel = (label: string, l: Locale = "it") =>
  (l === "en" && label.trim().toLowerCase() === "punti" ? "Points" : label);
