"use client";
import { useActionState } from "react";
import { addPlayer, deletePlayer, updatePlayer, type FormState } from "./actions";

const input = "rounded border bg-transparent px-3 py-2";
const msg = (s: FormState) =>
  s.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-sm text-green-700 dark:text-green-400">{s.ok}</p> : null;

export function AddPlayerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addPlayer, {});
  return (
    <form action={action} className="mt-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto]">
      <input name="full_name" placeholder="Nome e cognome" required className={input} aria-label="Nome e cognome" />
      <input name="club" placeholder="Circolo (facoltativo)" className={input} aria-label="Circolo" />
      <button disabled={pending} className="btn-primary">Aggiungi</button>
      <div className="sm:col-span-3">{msg(state)}</div>
    </form>
  );
}

export function PlayerRow({ player }: { player: { id: string; full_name: string; club: string | null; active: boolean; championships: string[] } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePlayer, {});
  const [delState, delAction, delPending] = useActionState<FormState, FormData>(deletePlayer, {});
  return (
    <li className="py-3">
      <form action={action} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input type="hidden" name="id" value={player.id} />
        <input name="full_name" defaultValue={player.full_name} required className={input} aria-label="Nome" />
        <input name="club" defaultValue={player.club ?? ""} className={input} aria-label="Circolo" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={player.active} /> Attivo</label>
        <button disabled={pending} className="rounded border px-3 py-2 text-sm">Salva</button>
      </form>
      <div className="mt-1 flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
        <span>{player.championships.length ? `Campionati: ${player.championships.join(", ")}` : "In nessun campionato"}</span>
        <form action={delAction}>
          <input type="hidden" name="id" value={player.id} />
          <button disabled={delPending} className="underline">Elimina</button>
        </form>
        {msg(state)}{msg(delState)}
      </div>
    </li>
  );
}
