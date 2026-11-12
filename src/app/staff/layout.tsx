import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/current-staff";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireRole("STAFF");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-neutral-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r">
        <Link href="/staff/queue" className="font-semibold">QR Restaurant</Link>
        <p className="mt-5 text-sm text-neutral-600">{staff.name} · Staff</p>
        <nav aria-label="Navigasi Staff" className="mt-7 space-y-1">
          <Link href="/staff/queue" className="block rounded-md bg-neutral-100 px-3 py-2 text-sm">Antrean Pesanan</Link>
          <span aria-disabled="true" className="block cursor-not-allowed px-3 py-2 text-sm text-neutral-400">Riwayat Pesanan</span>
          <Link href="/staff/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100">Profil Akun</Link>
        </nav>
        <form action={signOut} className="mt-7"><button className="text-sm text-neutral-600 underline">Keluar</button></form>
      </aside>
      <div className="p-5 md:p-8">{children}</div>
    </div>
  );
}
