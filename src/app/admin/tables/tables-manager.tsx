"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DiningTable = { id: string; table_code: string; table_number: number; is_active: boolean };

export function TablesManager({ initialTables }: { initialTables: DiningTable[] }) {
  const [tables, setTables] = useState<DiningTable[]>(initialTables);
  const [number, setNumber] = useState("");
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [tableToDeactivate, setTableToDeactivate] = useState<DiningTable | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/v1/admin/tables", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    setTables(result.data);
  }

  async function mutate(url: string, method: string, body?: unknown) {
    if (pending) return false;
    setPending(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message ?? "Terjadi kesalahan.");
        return false;
      }
      toast.success(result.message ?? "Berhasil.");
      await load();
      return true;
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi server.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function addTable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await mutate("/api/v1/admin/tables", "POST", { tableNumber: Number(number) })) setNumber("");
  }

  async function saveTableNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTable) return;
    const saved = await mutate(`/api/v1/admin/tables/${editingTable.id}`, "PATCH", { tableNumber: Number(editingNumber) });
    if (saved) setEditingTable(null);
  }

  return (
    <div aria-busy={pending || undefined} className="mt-6 space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={addTable}>
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="new-table-number">Nomor meja</Label>
          <Input id="new-table-number" type="number" min="1" required value={number} onChange={(event) => setNumber(event.target.value)} />
        </div>
        <Button type="submit" loading={pending}>Tambah meja</Button>
        <Button type="button" variant="outline" onClick={() => window.open("/api/v1/admin/tables/qr-pdf", "_blank", "noopener,noreferrer")}>Unduh semua QR (PDF)</Button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-secondary/60">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Meja</th>
                <th scope="col" className="px-4 py-3 font-medium">Kode QR (UUIDv4)</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">Meja {String(table.table_number).padStart(2, "0")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{table.table_code}</td>
                  <td className="px-4 py-3">
                    <Badge className={table.is_active ? "border-transparent bg-success-soft text-success" : "border-border bg-transparent text-muted-foreground"}>
                      {table.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {table.is_active ? <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingTable(table); setEditingNumber(String(table.table_number)); }}>Ubah nomor</Button>
                        <Button size="sm" variant="destructive" onClick={() => setTableToDeactivate(table)}>Nonaktifkan</Button>
                        <Button size="sm" variant="ghost" onClick={() => window.open(`/api/v1/admin/tables/${table.id}/qr`, "_blank", "noopener,noreferrer")}>Unduh QR</Button>
                      </> : <Button size="sm" variant="outline" loading={pending} onClick={() => void mutate(`/api/v1/admin/tables/${table.id}`, "PATCH", { isActive: true })}>Aktifkan</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {tables.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Belum ada meja.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={editingTable !== null} onOpenChange={(open) => { if (!open) setEditingTable(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah nomor meja</DialogTitle>
            <DialogDescription>Kode QR tetap sama setelah nomor meja diubah.</DialogDescription>
          </DialogHeader>
          <form id="edit-table-form" className="space-y-2" onSubmit={saveTableNumber}>
            <Label htmlFor="edit-table-number">Nomor meja</Label>
            <Input id="edit-table-number" type="number" min="1" required value={editingNumber} onChange={(event) => setEditingNumber(event.target.value)} />
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingTable(null)}>Batal</Button>
            <Button type="submit" form="edit-table-form" loading={pending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={tableToDeactivate !== null} onOpenChange={(open) => { if (!open) setTableToDeactivate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan meja?</AlertDialogTitle>
            <AlertDialogDescription>QR meja {tableToDeactivate?.table_number} tidak akan dapat memulai sesi baru.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const table = tableToDeactivate;
                if (table) {
                  void mutate(`/api/v1/admin/tables/${table.id}`, "DELETE")
                    .then((saved) => { if (saved) setTableToDeactivate(null); });
                }
              }}
              loading={pending}
            >
              Nonaktifkan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
