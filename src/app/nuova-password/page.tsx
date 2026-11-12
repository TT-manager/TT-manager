import { NewPasswordForm } from "../login/login-form";

export const metadata = { title: "Nuova password" };

export default function NewPasswordPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Scegli una nuova password</h1>
      <NewPasswordForm />
    </main>
  );
}
