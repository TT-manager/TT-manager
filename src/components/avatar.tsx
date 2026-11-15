import { avatarUrl } from "@/lib/avatar";

/** Foto del giocatore, oppure un cerchietto con le iniziali. */
export function Avatar({ name, path, size = "h-8 w-8 text-xs" }: { name: string; path?: string | null; size?: string }) {
  const src = avatarUrl(path);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- foto piccole già ridimensionate al caricamento
    return <img src={src} alt="" loading="lazy" className={`inline-block shrink-0 rounded-full object-cover ring-2 ring-white/70 dark:ring-white/20 ${size}`} />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  // Tutti dello stesso grigio: un colore diverso farebbe pensare a un significato che non c'è.
  const bg = "bg-neutral-300 text-ink dark:bg-neutral-700 dark:text-white";
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${size} ${bg}`}>{initials}</span>;
}
