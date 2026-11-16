"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payment = { method: string; status: string; amount: number; paid_at: string | null; attempt_number: number };
type Transaction = { id: string; order_number: string; table_number_snapshot: number; customer_name: string | null; order_status: string; payment_status: string; total_amount: number; discount_amount: number; operational_date: string; paid_at: string | null; payments: Payment[] };
type Props = { endpoint: string; detailRoot: string; canCancel?: boolean };
const statusLabels: Record<string, string> = { PENDING: "Menunggu", PAID: "Dibayar", FAILED: "Gagal", EXPIRED: "Kedaluwarsa", CANCELLED: "Dibatalkan" };
const reasonOptions = [
  ["CUSTOMER_REQUEST", "Permintaan pelanggan"],
  ["DUPLICATE_ORDER", "Pesanan duplikat"],
  ["ITEM_UNAVAILABLE", "Item tidak tersedia"],
  ["OPERATIONAL_ISSUE", "Kendala operasional"],
  ["OTHER", "Lainnya"],
];
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "—";

export function TransactionBrowser({ endpoint, detailRoot, canCancel = false }: Props) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const response = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Transaksi belum dapat dimuat.");
      setItems(result.data.transactions); setTotalPages(result.data.totalPages || 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Transaksi belum dapat dimuat."); }
    finally { setLoading(false); }
  }, [endpoint, from, page, search, status, to]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setPage(1); setSearch(query.trim()); };
  const submitCancel = async () => {
    if (!selected || !reason) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/v1/admin/orders/${selected.id}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCode: reason, ...(reason === "OTHER" ? { reasonOther } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Pesanan belum dapat dibatalkan.");
      toast.success("Pesanan dibatalkan dan dicatat di Audit Log.");
      setSelected(null); setReason(""); setReasonOther(""); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Pesanan belum dapat dibatalkan."); }
    finally { setCancelling(false); }
  };

  return <div className="space-y-5">
    <form onSubmit={submitSearch} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(14rem,1fr)_12rem_10rem_10rem_auto] md:items-end">
      <div className="space-y-2"><Label htmlFor="transaction-search">Nomor pesanan</Label><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="transaction-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor order" /></div></div>
      <div className="space-y-2"><Label>Status pembayaran</Label><Select value={status} onValueChange={(value) => { setStatus(value ?? "ALL"); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Semua status</SelectItem>{Object.keys(statusLabels).map((key) => <SelectItem key={key} value={key}>{statusLabels[key]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="transaction-from">Dari tanggal</Label><Input id="transaction-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
      <div className="space-y-2"><Label htmlFor="transaction-to">Sampai tanggal</Label><Input id="transaction-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
      <Button type="submit"><Search /> Cari</Button>
    </form>
    <Card><CardContent className="p-0">
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground" aria-live="polite">Memuat transaksi…</p> : error ? <div className="space-y-3 p-8 text-center"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Coba lagi</Button></div> : items.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada transaksi yang cocok.</p> : <Table>
        <TableHeader><TableRow><TableHead>Pesanan</TableHead><TableHead>Meja</TableHead><TableHead>Tanggal operasional</TableHead><TableHead>Waktu bayar</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item) => <TableRow key={item.id}>
          <TableCell><Link className="font-medium text-primary hover:underline" href={`${detailRoot}/${item.id}`}>{item.order_number}</Link><div className="text-xs text-muted-foreground">{item.customer_name || "Pelanggan"}</div></TableCell>
          <TableCell>Meja {String(item.table_number_snapshot).padStart(2, "0")}</TableCell><TableCell>{item.operational_date.split("-").reverse().join("/")}</TableCell><TableCell>{dateTime(item.paid_at)}</TableCell>
          <TableCell><Badge variant={item.payment_status === "PAID" ? "default" : item.payment_status === "PENDING" ? "secondary" : "outline"}>{statusLabels[item.payment_status] ?? item.payment_status}</Badge></TableCell>
          <TableCell className="text-right tabular-nums">{money(item.total_amount)}</TableCell><TableCell>{canCancel && item.payment_status === "PENDING" ? <Button variant="destructive" size="sm" onClick={() => { setReason(""); setReasonOther(""); setSelected(item); }}>Batalkan</Button> : <Button asChild variant="outline" size="sm"><Link href={`${detailRoot}/${item.id}`}>Detail</Link></Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table>}
      {!loading && !error && totalPages > 1 && <div className="flex items-center justify-between border-t p-4 text-sm"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></div></div>}
    </CardContent></Card>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open && !cancelling) { setSelected(null); setReason(""); setReasonOther(""); } }}>
      <DialogContent><DialogHeader><DialogTitle>Batalkan pesanan {selected?.order_number}?</DialogTitle><DialogDescription>Status pembayaran akan diverifikasi ke Midtrans sebelum pesanan dibatalkan. Pembayaran sukses tidak dapat dibatalkan.</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label>Alasan pembatalan</Label><Select value={reason} onValueChange={(value) => setReason(value ?? "")}><SelectTrigger><SelectValue placeholder="Pilih alasan" /></SelectTrigger><SelectContent>{reasonOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        {reason === "OTHER" && <div className="space-y-2"><Label htmlFor="cancel-reason-other">Jelaskan alasan</Label><Input id="cancel-reason-other" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} maxLength={500} /></div>}
        <DialogFooter><Button variant="outline" onClick={() => setSelected(null)} disabled={cancelling}>Kembali</Button><Button variant="destructive" onClick={() => void submitCancel()} loading={cancelling} disabled={!reason || (reason === "OTHER" && !reasonOther.trim())}>Batalkan pesanan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
