"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type HistoryTicket = {
  id: string;
  paid_at: string;
  operational_date: string;
  ticket_payload_snapshot: {
    orderNumber: string;
    tableNumber: number;
    customerName: string | null;
    items: Array<{ name: string; quantity: number }>;
  };
};

export function KitchenHistory() {
  const [order, setOrder] = useState("");
  const [table, setTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<HistoryTicket[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page) });
    if (order.trim()) query.set("q", order.trim());
    if (table.trim()) query.set("table", table.trim());
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    try {
      const response = await fetch(`/api/v1/staff/kitchen/history?${query}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Riwayat belum dapat dimuat.");
      setTickets(result.data.tickets as HistoryTicket[]);
      setTotalPages(result.data.totalPages);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Riwayat belum dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, order, page, table, to]);

  useEffect(() => {
    // Query filtered history when the page or any filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = setInterval(() => void load(), 60_000);
    return () => clearInterval(refresh);
  }, [load]);

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Riwayat Pesanan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pesanan dikelompokkan berdasarkan tanggal operasional terbaru.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            aria-label="Cari nomor pesanan"
            placeholder="Nomor pesanan"
            value={order}
            onChange={(event) => {
              setPage(1);
              setOrder(event.target.value);
            }}
          />
          <Input
            aria-label="Filter nomor meja"
            type="number"
            min="1"
            placeholder="Nomor meja"
            value={table}
            onChange={(event) => {
              setPage(1);
              setTable(event.target.value);
            }}
          />
          <Input
            aria-label="Dari tanggal"
            type="date"
            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
          />
          <Input
            aria-label="Sampai tanggal"
            type="date"
            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
          />
          <Button variant="outline" onClick={() => void load()}>
            Terapkan filter
          </Button>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat riwayat…</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Belum ada pesanan dalam riwayat.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {Array.from(
            new Set(tickets.map((ticket) => ticket.operational_date)),
          ).map((date) => (
            <section key={date} className="space-y-3">
              <h2 className="font-semibold">
                Tanggal operasional{" "}
                {new Date(`${date}T12:00:00`).toLocaleDateString("id-ID", {
                  dateStyle: "full",
                })}
              </h2>
              {tickets
                .filter((ticket) => ticket.operational_date === date)
                .map((ticket) => (
                  <Card key={ticket.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">
                          {ticket.ticket_payload_snapshot.orderNumber} · Meja{" "}
                          {ticket.ticket_payload_snapshot.tableNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(ticket.paid_at).toLocaleTimeString(
                            "id-ID",
                            {
                              timeZone: "Asia/Jakarta",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}{" "}
                          WIB · {ticket.ticket_payload_snapshot.items.length}{" "}
                          item
                          {ticket.ticket_payload_snapshot.items.length === 1
                            ? ""
                            : "s"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/staff/queue/${ticket.id}?from=history`}>
                          Lihat detail
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </section>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => current - 1)}
        >
          Sebelumnya
        </Button>
        <span className="text-sm text-muted-foreground">
          Halaman {page} dari {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </main>
  );
}
