"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import type { ActionState } from "@/components/action-form";
import { removeAvatar, uploadAvatar } from "./actions";

const SIZE = 400;

/** Ritaglia al centro un quadrato, lo porta a 400×400 e lo ricodifica: via i dati nascosti (es. GPS). */
export async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await encode("image/jpeg");
  if (!jpg) throw new Error("encode");
  return jpg;
}

export function AvatarUploader({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadAvatar, {});
  const [removeState, remove, removing] = useActionState<ActionState, FormData>(removeAvatar, {});
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const msg = localError ? { error: localError } : state.error || state.ok ? state : removeState;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setLocalError(null);
        try {
          const blob = await prepare(file);
          const data = new FormData();
          data.set("photo", new File([blob], blob.type === "image/webp" ? "foto.webp" : "foto.jpg", { type: blob.type }));
          startTransition(() => action(data));
        } catch {
          setLocalError("Non riesco a leggere questa immagine: prova con un'altra foto.");
        }
      }} />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className="btn-outline px-3 py-1.5 text-sm">
        {pending ? "Caricamento…" : hasPhoto ? "Cambia foto" : "Aggiungi una foto"}</button>
      {hasPhoto && <button type="button" disabled={removing} className="text-muted underline hover:text-brand"
        onClick={() => { if (confirm("Togliere la foto?")) startTransition(() => remove(new FormData())); }}>Togli</button>}
      {msg.error && <span role="alert" className="text-red-700 dark:text-red-400">{msg.error}</span>}
      {msg.ok && <span className="text-green-700 dark:text-green-400">{msg.ok}</span>}
    </div>
  );
}
