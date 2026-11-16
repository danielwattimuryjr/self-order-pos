"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Ticket = { id: string; paid_at: string; ticket_payload_snapshot: { orderNumber: string; tableNumber: number; customerName: string | null; items: Array<{ name: string; quantity: number; note: string; variants: Array<{ group: string; option: string }>; addons: Array<{ group: string; option: string; quantity: number }> }> }; isNew: boolean };

function playNotice() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.12;
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + 0.18);
  oscillator.onended = () => void context.close();
}

export function KitchenQueue() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);

  const load = useCallback(async (playForNew = true) => {
    try {
      const response = await fetch("/api/v1/staff/kitchen/queue", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Antrean belum dapat dimuat.");
      const next = result.data.tickets as Ticket[];
      const nextIds = new Set(next.map((ticket) => ticket.id));
      const previous = knownIds.current;
      if (playForNew && soundEnabled && previous && next.some((ticket) => !previous.has(ticket.id))) playNotice();
      knownIds.current = nextIds;
      setTickets(next); setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Antrean belum dapat dimuat.");
    } finally { setLoading(false); }
  }, [soundEnabled]);

  useEffect(() => {
    let active = true;
    let hadConnection = false;
    // Load the queue snapshot before applying realtime notifications.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    const supabase = createClient();
    const channel = supabase.channel(`staff-kitchen-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, () => { if (active) void load(); })
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (hadConnection) void load(false);
          hadConnection = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnected(false);
      });
    const fallback = setInterval(() => { if (active) void load(); }, 30_000);
    const onFocus = () => { if (active) void load(false); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; clearInterval(fallback); window.removeEventListener("focus", onFocus); void supabase.removeChannel(channel); };
  }, [load]);

  return <main className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Antrean Pesanan</h1><p className="mt-1 text-sm text-muted-foreground">Tiket baru diurutkan berdasarkan waktu pembayaran.</p></div><Button variant={soundEnabled ? "secondary" : "outline"} onClick={() => setSoundEnabled((enabled) => !enabled)}>{soundEnabled ? "Matikan Suara" : "Aktifkan Suara"}</Button></div>
    <div role="status" className={connected ? "text-sm text-success" : "text-sm text-warning"}>{connected ? "Terhubung" : "Koneksi Terputus · mencoba menyambungkan kembali"}</div>
    {error && <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load(false)}>Coba lagi</Button></CardContent></Card>}
    {loading ? <p className="text-sm text-muted-foreground">Memuat antrean…</p> : !tickets.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Belum ada pesanan aktif.</CardContent></Card> : <div className="grid gap-3 lg:grid-cols-2">{tickets.map((ticket) => <Card key={ticket.id}><CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{ticket.ticket_payload_snapshot.orderNumber} · Meja {ticket.ticket_payload_snapshot.tableNumber}</p><p className="text-xs text-muted-foreground">Dibayar {new Date(ticket.paid_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB{ticket.ticket_payload_snapshot.customerName ? ` · ${ticket.ticket_payload_snapshot.customerName}` : ""}</p></div>{ticket.isNew && <Badge>BARU</Badge>}</div>
      <ul className="space-y-1 text-sm">{ticket.ticket_payload_snapshot.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span>{item.variants?.map((choice, choiceIndex) => <span className="block pl-5 text-xs text-muted-foreground" key={`v-${choiceIndex}`}>{choice.group}: {choice.option}</span>)}{item.addons?.map((choice, choiceIndex) => <span className="block pl-5 text-xs text-muted-foreground" key={`a-${choiceIndex}`}>{choice.quantity > 1 ? `${choice.quantity} × ` : ""}{choice.group}: {choice.option}</span>)}{item.note && <span className="block pl-5 text-xs text-muted-foreground">Catatan: {item.note}</span>}</li>)}</ul>
      <Button variant="outline" size="sm" asChild><Link href={`/staff/queue/${ticket.id}`}>Lihat detail</Link></Button>
    </CardContent></Card>)}</div>}
  </main>;
}
