"use client";
import { useState } from "react";

/** «Punti a set» di una sfida: 11, 21 oppure un valore a scelta (campo `set_points`). */
export function SetPointsField({ label, customLabel, className }: { label: string; customLabel: string; className: string }) {
  const [choice, setChoice] = useState("11");
  const [custom, setCustom] = useState("15");
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor="set_points_choice">{label}</label>
      <select id="set_points_choice" value={choice} onChange={(e) => setChoice(e.target.value)} className={className}>
        <option value="11">11</option>
        <option value="21">21</option>
        <option value="custom">{customLabel}</option>
      </select>
      {choice === "custom" && (
        <input type="number" min={3} max={50} required value={custom} onChange={(e) => setCustom(e.target.value)}
          aria-label={label} className="mt-2 w-full rounded border bg-transparent px-3 py-2" />)}
      <input type="hidden" name="set_points" value={choice === "custom" ? custom : choice} />
    </div>
  );
}
