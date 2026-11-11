"use client";
import { useActionState } from "react";
import { login, type OrgState } from "./actions";

const btn = "rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";
const Msg = ({ s }: { s: OrgState }) =>
  s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;

export function OrganizerLogin({ publicCode }: { publicCode: string }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 max-w-sm space-y-3">
      <input type="hidden" name="public_code" value={publicCode} />
      <label className="block">Codice organizzatore
        <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="ABCDE-FGHJK"
          className="mt-1 w-full rounded border bg-transparent px-3 py-2 font-mono text-xl uppercase tracking-widest" /></label>
      <button disabled={pending} className={btn}>{pending ? "Verifica…" : "Entra"}</button>
      <Msg s={state} />
    </form>
  );
}
