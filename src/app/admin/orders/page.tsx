import { TransactionBrowser } from "@/components/shared/transaction-browser";

export default function AdminOrdersPage() {
  return <main className="space-y-6"><div><h1 className="text-2xl font-semibold">Pesanan</h1><p className="mt-1 text-sm text-muted-foreground">Pantau order dan batalkan order unpaid setelah status Midtrans diverifikasi.</p></div><TransactionBrowser endpoint="/api/v1/admin/transactions" detailRoot="/admin/transactions" canCancel /></main>;
}
