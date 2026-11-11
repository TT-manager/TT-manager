import LoginForm from "./login-form";

export const metadata = { title: "Accesso amministratori" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Accesso amministratori</h1>
      <LoginForm />
    </main>
  );
}
