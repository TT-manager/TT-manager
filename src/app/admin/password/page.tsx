import PasswordForm from "./password-form";

export const metadata = { title: "Cambia password" };

export default function PasswordPage() {
  return (
    <main className="max-w-sm">
      <h1 className="text-2xl font-bold">Cambia password</h1>
      <PasswordForm />
    </main>
  );
}
