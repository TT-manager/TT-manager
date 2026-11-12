import { ForgotForm } from "../login/login-form";

export const metadata = { title: "Password dimenticata" };

export default function ForgotPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Password dimenticata</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Ti mandiamo un link per sceglierne una nuova.</p>
      <ForgotForm />
    </main>
  );
}
