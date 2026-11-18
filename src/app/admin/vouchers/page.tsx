import { VouchersManager } from "@/components/admin/vouchers-manager";

export default function AdminVouchersPage() {
  return (
    <main>
      <header className="space-y-1">
        <h1 className="text-page-title font-semibold">Voucher</h1>
        <p className="text-sm text-muted-foreground">
          Kelola diskon, periode berlaku, kuota, dan kategori yang memenuhi
          syarat.
        </p>
      </header>
      <VouchersManager />
    </main>
  );
}
