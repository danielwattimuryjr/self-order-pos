import { TransactionBrowser } from "@/components/shared/transaction-browser";

export default function StaffTransactionsPage() {
  return <main className="space-y-6"><div><h1 className="text-2xl font-semibold">Transaksi</h1><p className="mt-1 text-sm text-muted-foreground">Detail order dan pembayaran untuk keperluan operasional.</p></div><TransactionBrowser endpoint="/api/v1/staff/orders" detailRoot="/staff/transactions" /></main>;
}
