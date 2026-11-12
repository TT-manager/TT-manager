/** Cerchietto con le iniziali (al posto della foto). */
export function Avatar({ name, size = "h-8 w-8 text-xs" }: { name: string; size?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  // Colore stabile per nome, nella gamma rosso/grigio del sito.
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const bg = hue % 3 === 0 ? "bg-brand text-white" : hue % 3 === 1 ? "bg-ink text-white dark:bg-neutral-700" : "bg-neutral-300 text-ink dark:bg-neutral-600 dark:text-white";
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${size} ${bg}`}>{initials}</span>;
}
