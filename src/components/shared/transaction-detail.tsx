"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  orderId: string;
  endpoint: string;
  backHref: string;
  adminPresentation?: boolean;
};
type Order = {
  id: string;
  order_number: string;
  table_number_snapshot: number;
  customer_name: string | null;
  order_notes: string;
  order_status: string;
  payment_status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  operational_date: string;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  voucher_snapshot: { code?: string; name?: string } | null;
};
type Detail = {
  order: Order;
  items: Array<{
    id: string;
    menu_name_snapshot: string;
    category_name_snapshot: string;
    quantity: number;
    item_note: string;
    variant_snapshot: Array<{ group?: string; option?: string }>;
    addon_snapshot: Array<{
      group?: string;
      option?: string;
      quantity?: number;
    }>;
    unit_price_snapshot: number;
    line_total: number;
  }>;
  payments: Array<{
    attempt_number: number;
    method: string;
    status: string;
    amount: number;
    created_at: string;
    paid_at: string | null;
  }>;
};
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const statusLabel = (value: string) =>
  ({
    PENDING: "Menunggu",
    PAID: "Dibayar",
    FAILED: "Gagal",
    EXPIRED: "Kedaluwarsa",
    CANCELLED: "Dibatalkan",
  })[value] ?? value;
const orderStatusLabel = (value: string) =>
  ({
    PENDING_PAYMENT: "Menunggu pembayaran",
    PAID: "Dikonfirmasi",
    CANCELLED: "Dibatalkan",
    EXPIRED: "Kedaluwarsa",
  })[value] ?? value;

export function TransactionDetail({
  orderId,
  endpoint,
  backHref,
  adminPresentation = false,
}: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch(`${endpoint}/${orderId}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message ?? "Detail transaksi belum dapat dimuat.",
          );
        return result.data as Detail;
      })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Detail transaksi belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, orderId]);

  if (loading)
    return (
      <p className="p-8 text-sm text-muted-foreground" aria-live="polite">
        Memuat detail transaksi…
      </p>
    );
  if (error || !detail)
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {error || "Pesanan tidak ditemukan."}
        </p>
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft /> Kembali
          </Link>
        </Button>
      </div>
    );
  const { order, items, payments } = detail;
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="px-0">
        <Link href={backHref}>
          <ArrowLeft /> Kembali ke daftar
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meja {String(order.table_number_snapshot).padStart(2, "0")} ·
            Tanggal operasional{" "}
            {order.operational_date.split("-").reverse().join("/")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {adminPresentation && (
            <Badge
              variant={
                order.order_status === "PAID"
                  ? "default"
                  : order.order_status === "PENDING_PAYMENT"
                    ? "secondary"
                    : "outline"
              }
            >
              Pesanan · {orderStatusLabel(order.order_status)}
            </Badge>
          )}
          <Badge
            variant={
              order.payment_status === "PAID"
                ? "default"
                : order.payment_status === "PENDING"
                  ? "secondary"
                  : "outline"
            }
          >
            {adminPresentation ? "Pembayaran · " : ""}
            {statusLabel(order.payment_status)}
          </Badge>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {adminPresentation ? (
              <>
                <p>
                  <span className="text-muted-foreground">Pelanggan:</span>{" "}
                  {order.customer_name || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Dibuat:</span>{" "}
                  {dateTime(order.created_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Dibayar:</span>{" "}
                  {dateTime(order.paid_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Batas pembayaran:
                  </span>{" "}
                  {dateTime(order.expires_at)}
                </p>
              </>
            ) : (
              <>
                <p>Pelanggan: {order.customer_name || "—"}</p>
                <p>Dibuat: {dateTime(order.created_at)}</p>
                <p>Dibayar: {dateTime(order.paid_at)}</p>
                <p>Kedaluwarsa: {dateTime(order.expires_at)}</p>
              </>
            )}
            {order.cancelled_at && (
              <p>Dibatalkan: {dateTime(order.cancelled_at)}</p>
            )}
            {order.cancellation_reason && (
              <p>Alasan pembatalan: {order.cancellation_reason}</p>
            )}
            {order.order_notes && <p>Catatan: {order.order_notes}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span>
                  Diskon
                  {order.voucher_snapshot?.code
                    ? ` · ${order.voucher_snapshot.code}`
                    : ""}
                </span>
                <span>−{money(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{money(order.total_amount)}</span>
            </div>
            {payments.map((payment) => (
              <div
                key={payment.attempt_number}
                className="flex justify-between border-t pt-2"
              >
                <span>
                  Percobaan {payment.attempt_number} · {payment.method} ·{" "}
                  {statusLabel(payment.status)}
                </span>
                <span>{money(payment.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Item pesanan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead>Konfigurasi</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Total item</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.menu_name_snapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.category_name_snapshot}
                    </div>
                    {item.item_note && (
                      <div className="mt-1 text-xs">
                        Catatan: {item.item_note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {[
                      ...item.variant_snapshot.map(
                        (v) => `${v.group}: ${v.option}`,
                      ),
                      ...item.addon_snapshot.map(
                        (a) =>
                          `${a.group}: ${a.option}${a.quantity && a.quantity > 1 ? ` ×${a.quantity}` : ""}`,
                      ),
                    ].join(" · ") || "—"}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(item.line_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
