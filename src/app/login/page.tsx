import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { LoginForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect(staff.role === "ADMIN" ? "/admin/dashboard" : "/staff/queue");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-neutral-500">QR Restaurant Ordering System</p>
        <h1 className="mt-2 text-2xl font-semibold">Masuk ke akun staf</h1>
        <p className="mt-2 text-sm text-neutral-600">Gunakan email dan kata sandi yang diberikan Admin.</p>
        <LoginForm />
      </section>
    </main>
  );
}
