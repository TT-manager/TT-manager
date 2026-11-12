"use client";
import { useActionState } from "react";
import { addAdmin, removeAdmin, type AdminState } from "./actions";

const Msg = ({ s }: { s: AdminState }) =>
  s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;

export function AddAdminForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addAdmin, {});
  return (
    <div className="mt-6 space-y-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="email@esempio.it" aria-label="Email del nuovo amministratore"
          className="min-w-0 flex-1 rounded border bg-transparent px-3 py-2" />
        <button disabled={pending} className="btn-primary">Aggiungi</button>
      </form>
      <Msg s={state} />
      {state.tempPassword && (
        <div className="rounded-lg border-2 border-amber-500 p-4">
          <p>Account creato per <strong>{state.email}</strong>. Password provvisoria:</p>
          <p className="mt-2 font-mono text-2xl">{state.tempPassword}</p>
          <p className="mt-2 text-sm">Comunicala alla persona in modo riservato: <strong>non verrà più mostrata</strong>.
            Al primo accesso dovrà cambiarla dalla pagina «Password».</p>
        </div>
      )}
    </div>
  );
}

export function RemoveAdminButton({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(removeAdmin, {});
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(`Togliere ${email} dagli amministratori?`)) e.preventDefault(); }}>
      <input type="hidden" name="user_id" value={userId} />
      <button disabled={pending} className="text-sm underline">Togli</button>
      <Msg s={state} />
    </form>
  );
}
