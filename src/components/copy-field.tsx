"use client";
import { useState } from "react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded border bg-transparent px-3 py-2 font-mono text-sm" />
      <button type="button" className="rounded border px-3 py-2 text-sm" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* copia a mano */ }
      }}>{copied ? "Copiato!" : "Copia"}</button>
    </div>
  );
}
