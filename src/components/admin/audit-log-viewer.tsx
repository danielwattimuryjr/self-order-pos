"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Entry = { id: string; action: string; entity_type: string; entity_id: string | null; before_value: unknown; after_value: unknown; metadata: unknown; created_at: string; actor: { name: string; email: string } | null };
const dateTime = (value: string) => new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

export function AuditLogViewer() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const response = await fetch(`/api/v1/admin/audit-logs?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Audit Log belum dapat dimuat.");
      setEntries(result.data.entries); setTotalPages(result.data.totalPages || 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Audit Log belum dapat dimuat."); }
    finally { setLoading(false); }
  }, [from, page, query, to]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  return <div className="space-y-5">
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]"><div className="space-y-2"><Label htmlFor="audit-search">Cari aksi</Label><Input id="audit-search" value={query} onChange={(e) => { setQuery(e.target.value.trim()); setPage(1); }} placeholder="Contoh: ORDER_CANCELLED" /></div><div className="space-y-2"><Label htmlFor="audit-from">Dari tanggal</Label><Input id="audit-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div><div className="space-y-2"><Label htmlFor="audit-to">Sampai tanggal</Label><Input id="audit-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div></div>
    <Card><CardContent className="p-0">{loading ? <p className="p-8 text-center text-sm text-muted-foreground" aria-live="polite">Memuat Audit Log…</p> : error ? <div className="space-y-3 p-8 text-center"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Coba lagi</Button></div> : entries.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Belum ada catatan audit pada filter ini.</p> : <Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Admin</TableHead><TableHead>Aksi</TableHead><TableHead>Entitas</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader><TableBody>{entries.map((entry) => <TableRow key={entry.id}><TableCell>{dateTime(entry.created_at)}</TableCell><TableCell>{entry.actor?.name ?? "Akun dihapus"}</TableCell><TableCell className="font-medium">{entry.action}</TableCell><TableCell>{entry.entity_type}{entry.entity_id ? <span className="block max-w-40 truncate text-xs text-muted-foreground">{entry.entity_id}</span> : null}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setSelected(entry)}>Lihat</Button></TableCell></TableRow>)}</TableBody></Table>}
      {!loading && !error && totalPages > 1 && <div className="flex items-center justify-between border-t p-4 text-sm"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></div></div>}
    </CardContent></Card>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85svh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.action}</DialogTitle><DialogDescription>{selected?.actor?.email ?? "Akun dihapus"} · {selected ? dateTime(selected.created_at) : ""}</DialogDescription></DialogHeader><div className="space-y-4 text-sm"><section><h3 className="mb-2 font-medium">Sebelum</h3><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected?.before_value, null, 2) ?? "—"}</pre></section><section><h3 className="mb-2 font-medium">Sesudah</h3><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected?.after_value, null, 2) ?? "—"}</pre></section>{selected && selected.metadata !== null && typeof selected.metadata === "object" && Object.keys(selected.metadata).length > 0 ? <section><h3 className="mb-2 font-medium">Metadata</h3><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected.metadata, null, 2)}</pre></section> : null}</div></DialogContent></Dialog>
  </div>;
}
