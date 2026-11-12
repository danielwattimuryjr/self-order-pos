"use client";

import { useState } from "react";

type DiningTable = { id: string; table_code: string; table_number: number; is_active: boolean };

export function TablesManager({ initialTables }: { initialTables: DiningTable[] }) {
  const [tables, setTables] = useState<DiningTable[]>(initialTables);
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/v1/admin/tables", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    setTables(result.data);
  }

  async function mutate(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(result.message ?? "Terjadi kesalahan.");
    if (response.ok) await load();
  }

  return (
    <div className="mt-6">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void mutate("/api/v1/admin/tables", "POST", { tableNumber: Number(number) }); setNumber(""); }}>
        <label className="text-sm">Nomor meja<input type="number" min="1" required value={number} onChange={(event) => setNumber(event.target.value)} className="mt-1 block rounded-md border border-neutral-300 px-3 py-2" /></label>
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">Tambah meja</button>
        <button type="button" onClick={() => window.open("/api/v1/admin/tables/qr-pdf", "_blank", "noopener,noreferrer")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm">Unduh semua QR (PDF)</button>
      </form>
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50"><tr><th className="p-3">Meja</th><th className="p-3">Kode QR (UUIDv4)</th><th className="p-3">Status</th><th className="p-3">Tindakan</th></tr></thead>
          <tbody>{tables.map((table) => <tr key={table.id} className="border-b last:border-0">
            <td className="p-3">Meja {String(table.table_number).padStart(2, "0")}</td>
            <td className="p-3 font-mono text-xs">{table.table_code}</td>
            <td className="p-3">{table.is_active ? "Aktif" : "Nonaktif"}</td>
            <td className="flex flex-wrap gap-2 p-3">
              {table.is_active ? <>
                <button onClick={() => { const next = window.prompt("Nomor meja baru", String(table.table_number)); if (next && Number(next) !== table.table_number) void mutate(`/api/v1/admin/tables/${table.id}`, "PATCH", { tableNumber: Number(next) }); }} className="underline">Ubah nomor</button>
                <button onClick={() => { if (window.confirm("Nonaktifkan meja ini? QR tidak akan dapat memulai sesi baru.")) void mutate(`/api/v1/admin/tables/${table.id}`, "DELETE"); }} className="text-red-700 underline">Nonaktifkan</button>
                <button onClick={() => window.open(`/api/v1/admin/tables/${table.id}/qr`, "_blank", "noopener,noreferrer")} className="underline">Unduh QR</button>
              </> : <button onClick={() => void mutate(`/api/v1/admin/tables/${table.id}`, "PATCH", { isActive: true })} className="underline">Aktifkan</button>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
