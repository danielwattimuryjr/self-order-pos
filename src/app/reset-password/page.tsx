import { PasswordForm } from "./password-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Buat kata sandi baru</h1>
        <p className="mt-2 text-sm text-neutral-600">Gunakan minimal 8 karakter, dengan huruf dan angka.</p>
        <PasswordForm />
      </section>
    </main>
  );
}
