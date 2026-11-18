"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  paid_at: string;
  ticket_payload_snapshot: {
    orderNumber: string;
    tableNumber: number;
    customerName: string | null;
    items: Array<{
      name: string;
      quantity: number;
      note: string;
      variants: Array<{ group: string; option: string }>;
      addons: Array<{ group: string; option: string; quantity: number }>;
    }>;
  };
  isNew: boolean;
};

function playNotice() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.12;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  oscillator.onended = () => void context.close();
}

export function KitchenQueue() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const load = useCallback(
    async (playForNew = true) => {
      setRefreshing(true);
      try {
        const response = await fetch("/api/v1/staff/kitchen/queue", {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message ?? "Antrean belum dapat dimuat.");
        const next = result.data.tickets as Ticket[];
        const nextIds = new Set(next.map((ticket) => ticket.id));
        const previous = knownIds.current;
        if (
          playForNew &&
          soundEnabled &&
          previous &&
          next.some((ticket) => !previous.has(ticket.id))
        )
          playNotice();
        knownIds.current = nextIds;
        setTickets(next);
        setLastUpdated(new Date());
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Antrean belum dapat dimuat.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [soundEnabled],
  );

  useEffect(() => {
    let active = true;
    let hadConnection = false;
    // Load the queue snapshot before applying realtime notifications.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-kitchen-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_tickets" },
        () => {
          if (active) void load();
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (hadConnection) void load(false);
          hadConnection = true;
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          setConnected(false);
      });
    const fallback = setInterval(() => {
      if (active) void load();
    }, 30_000);
    const onFocus = () => {
      if (active) void load(false);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Antrean Pesanan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiket baru diurutkan berdasarkan waktu pembayaran.
          </p>
        </div>
        <Button
          variant={soundEnabled ? "secondary" : "outline"}
          onClick={() => setSoundEnabled((enabled) => !enabled)}
        >
          {soundEnabled ? "Matikan Suara" : "Aktifkan Suara"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p
          role="status"
          className={connected ? "text-success" : "text-warning"}
        >
          {connected
            ? "Pembaruan langsung terhubung"
            : "Pembaruan langsung terputus · mencoba menyambungkan kembali"}
        </p>
        {refreshing && (
          <p role="status" className="text-muted-foreground">
            Memperbarui antrean…
          </p>
        )}
        {lastUpdated && (
          <p className="text-muted-foreground">
            Terakhir berhasil diperbarui{" "}
            {lastUpdated.toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            WIB
          </p>
        )}
      </div>
      {error && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" onClick={() => void load(false)}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat antrean…</p>
      ) : !tickets.length ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Belum ada pesanan aktif.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="min-w-0">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-semibold tabular-nums">
                      {ticket.ticket_payload_snapshot.orderNumber} · Meja{" "}
                      {ticket.ticket_payload_snapshot.tableNumber}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Dibayar pukul{" "}
                      {new Date(ticket.paid_at).toLocaleTimeString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      WIB
                    </p>
                    {ticket.ticket_payload_snapshot.customerName && (
                      <p className="mt-1 break-words text-sm">
                        {ticket.ticket_payload_snapshot.customerName}
                      </p>
                    )}
                  </div>
                  {ticket.isNew && (
                    <Badge
                      aria-label="Pesanan baru untuk akun Anda"
                      className="shrink-0"
                    >
                      BARU
                    </Badge>
                  )}
                </div>
                <ul className="space-y-3 border-t pt-3 text-sm">
                  {ticket.ticket_payload_snapshot.items.map((item, index) => (
                    <li className="min-w-0" key={`${item.name}-${index}`}>
                      <span className="font-medium">
                        <span className="mr-2 inline-block min-w-8 tabular-nums">
                          {item.quantity}×
                        </span>
                        {item.name}
                      </span>
                      {item.variants?.map((choice, choiceIndex) => (
                        <span
                          className="block pl-5 text-xs text-muted-foreground"
                          key={`v-${choiceIndex}`}
                        >
                          {choice.group}: {choice.option}
                        </span>
                      ))}
                      {item.addons?.map((choice, choiceIndex) => (
                        <span
                          className="block pl-5 text-xs text-muted-foreground"
                          key={`a-${choiceIndex}`}
                        >
                          {choice.quantity > 1 ? `${choice.quantity} × ` : ""}
                          {choice.group}: {choice.option}
                        </span>
                      ))}
                      {item.note && (
                        <span className="mt-1 block break-words rounded-md bg-muted px-3 py-2 text-sm">
                          <span className="font-medium">Catatan:</span>{" "}
                          {item.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  asChild
                >
                  <Link href={`/staff/queue/${ticket.id}`}>Lihat detail</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
