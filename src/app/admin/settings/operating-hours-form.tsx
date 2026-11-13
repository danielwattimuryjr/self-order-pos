"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<{ path: string; body?: unknown; message: string } | null>(null);

  async function load() {
    const response = await fetch("/api/v1/admin/settings/operating-hours", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    const data = result.data as Settings;
    setSettings(data);
    setOpening(data.opening_time?.slice(0, 5) ?? "");
    setClosing(data.closing_time?.slice(0, 5) ?? "");
  }

  async function send(path: string, body?: unknown) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(path, {
        method: path.endsWith("operating-hours") ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message ?? "Terjadi kesalahan.");
        return;
      }
      toast.success(result.message ?? "Berhasil.");
      await load();
      setConfirmation(null);
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  function requestSubmit(path: string, body?: unknown, confirmMessage?: string) {
    if (confirmMessage) {
      setConfirmation({ path, body, message: confirmMessage });
      return;
    }
    void send(path, body);
  }

  return (
    <div aria-busy={pending || undefined} className="mt-6 grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Jadwal harian</CardTitle>
          <p className="text-sm text-muted-foreground">Jam ini berlaku sama untuk setiap hari. Mendukung jadwal melewati tengah malam.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); requestSubmit("/api/v1/admin/settings/operating-hours", { openingTime: opening, closingTime: closing }); }}>
            <div className="space-y-2"><Label htmlFor="opening-time">Jam buka</Label><Input id="opening-time" type="time" required value={opening} onChange={(event) => setOpening(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="closing-time">Jam tutup</Label><Input id="closing-time" type="time" required value={closing} onChange={(event) => setClosing(event.target.value)} /></div>
            <Button type="submit" loading={pending}>Simpan jadwal</Button>
          </form>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status restoran</span>
            <Badge className={settings?.operatingStatus.status === "OPEN" ? "border-transparent bg-success-soft text-success" : settings?.operatingStatus.status === "TEMPORARILY_CLOSED" ? "border-transparent bg-warning-soft text-warning" : ""}>
              {settings?.operatingStatus.status ?? "Memuat…"}
            </Badge>
          </div>
          {settings?.operatingStatus.nextOpeningAt && <p className="mt-2 text-sm text-muted-foreground">Buka kembali: {new Date(settings.operatingStatus.nextOpeningAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tutup sementara</CardTitle>
        </CardHeader>
        <CardContent>
          {settings?.operatingStatus.status === "TEMPORARILY_CLOSED" ? (
            <>
              <p className="text-sm text-muted-foreground">Alasan: {settings.temporary_close_reason === "OTHER" ? settings.temporary_close_other : reasons.find(([key]) => key === settings.temporary_close_reason)?.[1]}</p>
              <Button onClick={() => requestSubmit("/api/v1/admin/restaurant/reopen", undefined, "Buka kembali restoran?")} loading={pending} className="mt-5">Buka kembali</Button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); requestSubmit("/api/v1/admin/restaurant/temporary-close", { reason, otherReason: other }, "Tutup restoran sementara?"); }}>
              <div className="space-y-2"><Label htmlFor="close-reason">Alasan</Label><Select value={reason} onValueChange={setReason}><SelectTrigger id="close-reason"><SelectValue placeholder="Pilih alasan" /></SelectTrigger><SelectContent>{reasons.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
              {reason === "OTHER" && <div className="space-y-2"><Label htmlFor="close-other">Keterangan</Label><Textarea id="close-other" required maxLength={500} value={other} onChange={(event) => setOther(event.target.value)} /></div>}
              <Button type="submit" variant="destructive" loading={pending}>Tutup sementara</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={confirmation !== null} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi tindakan</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              variant={confirmation?.path.endsWith("temporary-close") ? "destructive" : "default"}
              onClick={() => {
                const action = confirmation;
                if (action) void send(action.path, action.body);
              }}
              loading={pending}
            >
              {confirmation?.path.endsWith("reopen") ? "Buka kembali" : "Tutup sementara"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
