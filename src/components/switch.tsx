"use client";

/** Interruttore acceso/spento, grande abbastanza da toccarlo bene col dito. */
export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-brand" : "bg-neutral-400 dark:bg-neutral-600"}`}>
      <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
