/** Medaglia di legno per il 4° posto, grande come le emoji 🥇🥈🥉 accanto. */
export function WoodMedal({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 32 40" role="img" aria-label={label} className="inline-block h-[1.25em] w-[1em] align-[-0.25em]">
      <path d="M9 0h6l4 14h-6z" fill="#60a5fa" />
      <path d="M23 0h-6l-4 14h6z" fill="#2563eb" />
      <circle cx="16" cy="26" r="12" fill="#a8703d" stroke="#6b4423" strokeWidth="2" />
      <path d="M8 24c5-2 11 2 16-1M8.5 29c5-2 10 2 15-1" stroke="#c4925e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <text x="16" y="31" textAnchor="middle" fontSize="14" fontWeight="700" fill="#f5e6d3" fontFamily="system-ui, sans-serif">4</text>
    </svg>
  );
}
