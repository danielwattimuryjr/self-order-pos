import { VouchersManager } from "@/components/admin/vouchers-manager";

export default function AdminVouchersPage() {
  return <main>
    <h1 className="text-2xl font-semibold">Voucher</h1>
    <p className="mt-2 text-sm text-neutral-600">Kelola diskon, periode berlaku, kuota, dan kategori yang memenuhi syarat.</p>
    <VouchersManager />
  </main>;
}
