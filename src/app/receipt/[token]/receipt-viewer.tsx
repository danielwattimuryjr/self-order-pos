"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReceiptView = {
  orderNumber: string;
  tableNumber: number;
  customerName: string | null;
  orderNotes: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAt: string;
  paymentMethod: string | null;
  items: Array<{
    name: string;
    quantity: number;
    note: string;
    unitPrice: number;
    lineTotal: number;
    variants: unknown;
    addons: unknown;
  }>;
  emailStatus: "NOT_REQUESTED" | "PENDING" | "SENDING" | "SENT" | "FAILED";
  emailRequested: boolean;
  emailSentAt: string | null;
  orderAgainUrl: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function choiceLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((choice) => {
      if (!choice || typeof choice !== "object") return "";
      const row = choice as Record<string, unknown>;
      const group = row.groupName ?? row.group;
      const option = row.optionName ?? row.option ?? row.name ?? row.label;
      return `${group ? `${String(group)}: ` : ""}${String(option ?? "")}`;
    })
    .filter(Boolean);
}

export function ReceiptViewer({ token }: { token: string }) {
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [error, setError] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const loadReceipt = useCallback(async () => {
    const response = await fetch(
      `/api/v1/receipt/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message ?? "Struk belum dapat dimuat.");
    setReceipt(result.data as ReceiptView);
    setError("");
  }, [token]);

  useEffect(() => {
    let active = true;
    // Fetching an external resource from this effect initializes the page data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReceipt().catch((loadError: unknown) => {
      if (active)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Struk belum dapat dimuat.",
        );
    });
    const timer = setInterval(() => {
      if (
        receipt?.emailStatus === "PENDING" ||
        receipt?.emailStatus === "SENDING"
      )
        void loadReceipt().catch(() => undefined);
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadReceipt, receipt?.emailStatus]);

  async function retryEmail() {
    setEmailBusy(true);
    setEmailMessage("");
    try {
      const response = await fetch(
        `/api/v1/receipt/${encodeURIComponent(token)}/email`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ?? "Email struk belum berhasil dikirim.",
        );
      setEmailMessage("Struk berhasil dikirim ke email checkout.");
      await loadReceipt();
    } catch (sendError) {
      setEmailMessage(
        sendError instanceof Error
          ? sendError.message
          : "Email struk belum berhasil dikirim.",
      );
      await loadReceipt().catch(() => undefined);
    } finally {
      setEmailBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Struk belum tersedia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p role="alert" className="text-sm text-muted-foreground">
            {error}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              void loadReceipt().catch((e: unknown) =>
                setError(
                  e instanceof Error ? e.message : "Gagal memuat struk.",
                ),
              )
            }
          >
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  if (!receipt)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Memuat struk…
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-success">
            Pembayaran berhasil
          </p>
          <CardTitle>Struk Pesanan</CardTitle>
          <p className="text-sm text-muted-foreground">
            {receipt.orderNumber} · Meja {receipt.tableNumber}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              Waktu:{" "}
              {new Date(receipt.paidAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB
            </p>
            <p>Metode: {receipt.paymentMethod ?? "QRIS"}</p>
            {receipt.customerName && <p>Pelanggan: {receipt.customerName}</p>}
          </div>
          <div className="divide-y rounded-lg border">
            {receipt.items.map((item, index) => (
              <div className="space-y-1 p-3" key={`${item.name}-${index}`}>
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {money(item.lineTotal)}
                  </span>
                </div>
                {choiceLabels(item.variants).map((label, choiceIndex) => (
                  <p
                    className="text-xs text-muted-foreground"
                    key={`v-${choiceIndex}`}
                  >
                    {label}
                  </p>
                ))}
                {choiceLabels(item.addons).map((label, choiceIndex) => (
                  <p
                    className="text-xs text-muted-foreground"
                    key={`a-${choiceIndex}`}
                  >
                    {label}
                  </p>
                ))}
                {item.note && (
                  <p className="text-xs text-muted-foreground">
                    Catatan: {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          {receipt.orderNotes && (
            <p className="text-sm text-muted-foreground">
              Catatan pesanan: {receipt.orderNotes}
            </p>
          )}
          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(receipt.subtotal)}</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>−{money(receipt.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total dibayar</span>
              <span>{money(receipt.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {receipt.emailRequested && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm">
              {receipt.emailStatus === "SENT"
                ? "Struk sudah dikirim ke email checkout."
                : receipt.emailStatus === "PENDING" ||
                    receipt.emailStatus === "SENDING"
                  ? "Pengiriman otomatis sedang diproses."
                  : "Pengiriman email otomatis gagal. Anda dapat mencoba kembali ke alamat email checkout."}
            </p>
            {(receipt.emailStatus === "FAILED" ||
              receipt.emailStatus === "SENDING") && (
              <Button
                variant="outline"
                disabled={emailBusy}
                onClick={() => void retryEmail()}
              >
                {emailBusy ? "Mengirim…" : "Kirim ulang struk"}
              </Button>
            )}
            {emailMessage && (
              <p role="status" className="text-sm text-muted-foreground">
                {emailMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={`/api/v1/receipt/${encodeURIComponent(token)}/pdf`}>
            Unduh PDF
          </a>
        </Button>
        <Button variant="outline" onClick={() => void copyLink()}>
          {copied ? "Tautan disalin" : "Salin tautan"}
        </Button>
        {receipt.orderAgainUrl && (
          <Button variant="outline" asChild>
            <Link href={receipt.orderAgainUrl}>Pesan lagi</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
