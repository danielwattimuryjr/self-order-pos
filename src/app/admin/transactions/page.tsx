import { TransactionBrowser } from "@/components/shared/transaction-browser";

export default function AdminTransactionsPage() {
  return <main className="space-y-6"><div><h1 className="text-2xl font-semibold">Transaksi</h1><p className="mt-1 text-sm text-muted-foreground">Riwayat pembayaran dan status order.</p></div><TransactionBrowser endpoint="/api/v1/admin/transactions" detailRoot="/admin/transactions" /></main>;
}
