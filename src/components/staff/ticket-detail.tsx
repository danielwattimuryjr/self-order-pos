"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TicketDetailData = {
  id: string;
  paid_at: string;
  archived_at: string | null;
  ticket_payload_snapshot: { orderNumber: string; tableNumber: number; customerName: string | null; items: Array<{ name: string; quantity: number; note: string; variants: unknown; addons: unknown }> };
  order?: { order_number: string; table_number_snapshot: number; customer_name: string | null; order_notes: string; subtotal: number; discount_amount: number; total_amount: number; paid_at: string; operational_date: string };
  items?: Array<{ menu_name_snapshot: string; quantity: number; item_note: string; unit_price_snapshot: number; line_total: number; variant_snapshot: unknown; addon_snapshot: unknown }>;
  payment?: { method: string; status: string; paid_at: string } | null;
};
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
function choices(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((choice) => {
    if (!choice || typeof choice !== "object") return "";
    const row = choice as Record<string, unknown>;
    const label = row.option ?? row.optionName ?? row.name ?? "";
    const group = row.group ?? row.groupName;
    return `${group ? `${String(group)}: ` : ""}${String(label)}`;
  }).filter(Boolean);
}

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch(`/api/v1/staff/kitchen/tickets/${ticketId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Detail tiket belum dapat dimuat.");
      if (!active) return;
      setTicket(result.data as TicketDetailData);
      if (!result.data.archived_at) await fetch(`/api/v1/staff/kitchen/tickets/${ticketId}/read`, { method: "POST" });
    })().catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Detail tiket belum dapat dimuat."); });
    return () => { active = false; };
  }, [ticketId]);

  if (error) return <Card><CardContent className="p-5 text-sm text-destructive" role="alert">{error}</CardContent></Card>;
  if (!ticket) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Memuat detail tiket…</CardContent></Card>;
  const snapshot = ticket.ticket_payload_snapshot;
  return <Card><CardHeader><CardTitle>{snapshot.orderNumber} · Meja {snapshot.tableNumber}</CardTitle><p className="text-sm text-muted-foreground">Dibayar {new Date(ticket.paid_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB{snapshot.customerName ? ` · ${snapshot.customerName}` : ""}</p></CardHeader><CardContent className="space-y-4">
    {ticket.archived_at && ticket.order && <div className="grid gap-2 border-b pb-4 text-sm sm:grid-cols-2"><p>Tanggal operasional: {ticket.order.operational_date}</p><p>Metode pembayaran: {ticket.payment?.method ?? "QRIS"}</p></div>}
    <div className="space-y-3">{(ticket.items ?? snapshot.items).map((item, index) => {
      const name = "menu_name_snapshot" in item ? item.menu_name_snapshot : item.name;
      const note = "item_note" in item ? item.item_note : item.note;
      const variants = choices("variant_snapshot" in item ? item.variant_snapshot : item.variants);
      const addons = choices("addon_snapshot" in item ? item.addon_snapshot : item.addons);
      return <div className="flex justify-between gap-3 border-b pb-3 text-sm" key={`${name}-${index}`}><div><p>{item.quantity} × {name}</p>{variants.map((choice, choiceIndex) => <p className="text-xs text-muted-foreground" key={`v-${choiceIndex}`}>{choice}</p>)}{addons.map((choice, choiceIndex) => <p className="text-xs text-muted-foreground" key={`a-${choiceIndex}`}>{choice}</p>)}{note && <p className="text-xs text-muted-foreground">Catatan: {note}</p>}{ticket.archived_at && "unit_price_snapshot" in item && <p className="text-xs text-muted-foreground">{money(item.unit_price_snapshot)} per item</p>}</div>{ticket.archived_at && "line_total" in item && <span>{money(item.line_total)}</span>}</div>;
    })}</div>
    {ticket.archived_at && ticket.order && <div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(ticket.order.subtotal)}</span></div>{ticket.order.discount_amount > 0 && <div className="flex justify-between"><span>Diskon</span><span>−{money(ticket.order.discount_amount)}</span></div>}<div className="flex justify-between font-semibold"><span>Total</span><span>{money(ticket.order.total_amount)}</span></div>{ticket.order.order_notes && <p className="pt-2 text-muted-foreground">Catatan pesanan: {ticket.order.order_notes}</p>}</div>}
  </CardContent></Card>;
}
