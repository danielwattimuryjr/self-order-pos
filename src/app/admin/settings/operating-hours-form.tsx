"use client";

import { useState } from "react";

type Settings = {
  opening_time: string | null;
  closing_time: string | null;
  temporary_closed: boolean;
  temporary_close_reason: string | null;
  temporary_close_other: string | null;
  operatingStatus: { status: string; nextOpeningAt?: string };
};

const reasons = [
  ["STOCK_OUT", "Stok habis"],
  ["OPERATIONAL_ISSUE", "Gangguan operasional"],
  ["EMERGENCY", "Darurat"],
  ["OTHER", "Lainnya"],
];

export function OperatingHoursForm({ initialSettings }: { initialSettings: Settings | null }) {
  const [settings, setSettings] = useState<Settings | null>(initialSettings);
  const [opening, setOpening] = useState(initialSettings?.opening_time?.slice(0, 5) ?? "");
  const [closing, setClosing] = useState(initialSettings?.closing_time?.slice(0, 5) ?? "");
  const [reason, setReason] = useState("STOCK_OUT");
  const [other, setOther] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/v1/admin/settings/operating-hours", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    const data = result.data as Settings;
    setSettings(data);
    setOpening(data.opening_time?.slice(0, 5) ?? "");
    setClosing(data.closing_time?.slice(0, 5) ?? "");
  }

  async function submit(path: string, body?: unknown, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setMessage("");
    const response = await fetch(path, {
      method: path.endsWith("operating-hours") ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(result.message ?? (response.ok ? "Berhasil." : "Terjadi kesalahan."));
    if (response.ok) await load();
  }

  return (
    <div className="mt-6 grid max-w-3xl gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Jadwal harian</h2>
        <p className="mt-1 text-sm text-neutral-600">Jam ini berlaku sama untuk setiap hari. Mendukung jadwal melewati tengah malam.</p>
        <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit("/api/v1/admin/settings/operating-hours", { openingTime: opening, closingTime: closing }); }}>
          <label className="block text-sm">Jam buka<input type="time" required value={opening} onChange={(event) => setOpening(event.target.value)} className="mt-1 block rounded-md border border-neutral-300 px-3 py-2" /></label>
          <label className="block text-sm">Jam tutup<input type="time" required value={closing} onChange={(event) => setClosing(event.target.value)} className="mt-1 block rounded-md border border-neutral-300 px-3 py-2" /></label>
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">Simpan jadwal</button>
        </form>
        <p className="mt-4 text-sm">Status: {settings?.operatingStatus.status ?? "Memuat…"}</p>
        {settings?.operatingStatus.nextOpeningAt && <p className="text-sm text-neutral-600">Buka kembali: {new Date(settings.operatingStatus.nextOpeningAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Tutup sementara</h2>
        {settings?.operatingStatus.status === "TEMPORARILY_CLOSED" ? (
          <>
            <p className="mt-2 text-sm text-neutral-600">Alasan: {settings.temporary_close_reason === "OTHER" ? settings.temporary_close_other : reasons.find(([key]) => key === settings.temporary_close_reason)?.[1]}</p>
            <button onClick={() => void submit("/api/v1/admin/restaurant/reopen", undefined, "Buka kembali restoran?")} className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">Buka kembali</button>
          </>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit("/api/v1/admin/restaurant/temporary-close", { reason, otherReason: other }, "Tutup restoran sementara?"); }}>
            <label className="block text-sm">Alasan<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block rounded-md border border-neutral-300 px-3 py-2">{reasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {reason === "OTHER" && <label className="block text-sm">Keterangan<textarea required maxLength={500} value={other} onChange={(event) => setOther(event.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2" /></label>}
            <button className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-800">Tutup sementara</button>
          </form>
        )}
      </section>
      {message && <p role="status" className="text-sm text-neutral-700 lg:col-span-2">{message}</p>}
    </div>
  );
}
