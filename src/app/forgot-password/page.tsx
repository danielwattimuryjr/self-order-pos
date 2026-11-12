import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reset kata sandi</h1>
        <p className="mt-2 text-sm text-neutral-600">Masukkan email akun staf untuk menerima instruksi reset.</p>
        <ForgotPasswordForm />
        <Link href="/login" className="mt-5 block text-center text-sm text-neutral-600 underline">Kembali ke login</Link>
      </section>
    </main>
  );
}
