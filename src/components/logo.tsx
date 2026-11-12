/** Logo provvisorio: una racchetta stilizzata rossa e nera (verrà sostituito dal logo ufficiale). */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="13" cy="13" r="11" fill="#d6181f" />
      <path d="M13 2a11 11 0 0 1 0 22z" fill="#111113" />
      <rect x="18.5" y="19.5" width="4.5" height="11" rx="2.2" transform="rotate(-45 20.75 25)" fill="#8b5a2b" />
      <circle cx="26.5" cy="6" r="3" fill="#fff" stroke="#111113" strokeWidth="1" />
    </svg>
  );
}

export const SITE_NAME = "TT Manager";
