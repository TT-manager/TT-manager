import { Suspense } from "react";
import { safeNext } from "@/lib/account";
import LoginForm from "./login-form";

export const metadata = { title: "Accedi" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Accedi</h1>
      <Suspense fallback={<LoginForm />}><WithParams searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  return <>
    {sp.errore === "link" && <p role="alert" className="mt-4 text-red-700 dark:text-red-400">Il link non è valido o è scaduto. Accedi, oppure chiedi un nuovo link.</p>}
    <LoginForm next={typeof sp.next === "string" ? safeNext(sp.next) : undefined} />
  </>;
}
