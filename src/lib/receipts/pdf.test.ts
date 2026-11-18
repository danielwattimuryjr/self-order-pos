import { describe, expect, it } from "vitest";
import { createReceiptPdf } from "@/lib/receipts/pdf";
import type { ReceiptData } from "@/lib/receipts/receipt-data";

const receipt: ReceiptData = {
  id: "6f313828-c428-45e9-a05c-99e22f866b02",
  table_id: "a57ca4ce-3cf0-4b58-ae38-18a1092555e6",
  session_id: "d682ca51-a8ac-49b5-9c91-0069ac4c1e32",
  order_number: "ORD-151126001",
  table_number_snapshot: 3,
  customer_name: "Pelanggan",
  order_notes: "",
  payment_status: "PAID",
  subtotal: 15000,
  discount_amount: 0,
  total_amount: 15000,
  paid_at: "2026-11-15T10:00:00.000Z",
  access_token_hash: "a".repeat(64),
  access_token_revoked_at: null,
  receipt_email: null,
  operational_date: "2026-11-15",
  payment_method: "QRIS",
  receipt: { email_status: "NOT_REQUESTED", email_sent_at: null },
  items: [
    {
      menu_name_snapshot: "Nasi goreng 🌶️",
      quantity: 1,
      item_note: "Tidak pedas",
      unit_price_snapshot: 15000,
      line_total: 15000,
      variant_snapshot: [{ group: "Level", option: "Sedang" }],
      addon_snapshot: [],
    },
  ],
};

describe("receipt PDF", () => {
  it("generates a downloadable PDF from immutable order snapshots", async () => {
    const bytes = await createReceiptPdf(receipt);
    expect(Buffer.from(bytes).toString("ascii", 0, 4)).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
