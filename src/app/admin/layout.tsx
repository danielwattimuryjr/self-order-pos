import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/current-staff";

const upcoming = ["Pesanan", "Voucher", "Transaksi", "Staf", "Audit Log"];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireRole("ADMIN");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-neutral-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r">
        <Link href="/admin/dashboard" className="font-semibold">QR Restaurant</Link>
        <p className="mt-5 text-sm text-neutral-600">{staff.name} · Admin</p>
        <nav aria-label="Navigasi Admin" className="mt-7 space-y-1">
          <Link href="/admin/dashboard" className="block rounded-md bg-neutral-100 px-3 py-2 text-sm">Dashboard</Link>
          <Link href="/admin/tables" className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100">Meja</Link>
          <Link href="/admin/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100">Jam Operasional</Link>
          <Link href="/admin/catalog" className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100">Kategori &amp; Menu</Link>
          <Link href="/admin/templates" className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-100">Template Menu</Link>
          {upcoming.map((item) => <span key={item} aria-disabled="true" className="block cursor-not-allowed px-3 py-2 text-sm text-neutral-400">{item}</span>)}
        </nav>
        <form action={signOut} className="mt-7"><button className="text-sm text-neutral-600 underline">Keluar</button></form>
      </aside>
      <div className="p-5 md:p-8">{children}</div>
    </div>
  );
}
