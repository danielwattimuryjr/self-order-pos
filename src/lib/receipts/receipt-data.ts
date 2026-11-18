import "server-only";
import { timingSafeEqual } from "node:crypto";
import { failure } from "@/lib/api-response";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { hashOrderAccessToken } from "@/lib/security/order-access-token";
import { createServiceClient } from "@/lib/supabase/service";

export type ReceiptItem = {
  menu_name_snapshot: string;
  quantity: number;
  item_note: string;
  unit_price_snapshot: number;
  line_total: number;
  variant_snapshot: unknown;
  addon_snapshot: unknown;
};

export type ReceiptData = {
  id: string;
  table_id: string;
  session_id: string;
  order_number: string;
  table_number_snapshot: number;
  customer_name: string | null;
  order_notes: string;
  payment_status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_at: string | null;
  access_token_hash: string;
  access_token_revoked_at: string | null;
  receipt_email: string | null;
  operational_date: string;
  items: ReceiptItem[];
  payment_method: string | null;
  receipt: { email_status: string; email_sent_at: string | null } | null;
};
export type ReceiptLoadResult =
  { ok: false; response: Response } | { ok: true; data: ReceiptData };

function tokenMatches(expectedHash: string, token: string) {
  const actual = Buffer.from(hashOrderAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function loadAuthorizedReceipt(
  request: Request,
  token: string,
): Promise<ReceiptLoadResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return {
      ok: false,
      response: failure("RECEIPT_NOT_FOUND", "Struk tidak ditemukan.", 404),
    };
  }
  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, table_id, session_id, order_number, table_number_snapshot, customer_name, order_notes, payment_status, subtotal, discount_amount, total_amount, paid_at, access_token_hash, access_token_revoked_at, receipt_email, operational_date",
    )
    .eq("access_token_hash", hashOrderAccessToken(token))
    .maybeSingle();
  if (
    error ||
    !order ||
    order.access_token_revoked_at ||
    !tokenMatches(order.access_token_hash, token)
  ) {
    return {
      ok: false,
      response: failure("RECEIPT_NOT_FOUND", "Struk tidak ditemukan.", 404),
    };
  }
  const limited = await checkPublicOrderRateLimit(request, order.id);
  if (limited) return { ok: false, response: limited };
  if (order.payment_status !== "PAID" || !order.paid_at) {
    return {
      ok: false,
      response: failure(
        "RECEIPT_NOT_READY",
        "Struk tersedia setelah pembayaran dikonfirmasi.",
        409,
      ),
    };
  }

  const [
    { data: items, error: itemError },
    { data: payment, error: paymentError },
    { data: receipt, error: receiptError },
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "menu_name_snapshot, quantity, item_note, unit_price_snapshot, line_total, variant_snapshot, addon_snapshot",
      )
      .eq("order_id", order.id)
      .order("created_at")
      .order("id"),
    supabase
      .from("payments")
      .select("method")
      .eq("order_id", order.id)
      .eq("status", "PAID")
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("receipts")
      .select("email_status, email_sent_at")
      .eq("order_id", order.id)
      .maybeSingle(),
  ]);
  if (itemError || paymentError || receiptError || !items) {
    return {
      ok: false,
      response: failure(
        "RECEIPT_UNAVAILABLE",
        "Struk belum dapat dimuat. Coba kembali.",
        503,
      ),
    };
  }
  return {
    ok: true,
    data: {
      ...order,
      items,
      payment_method: payment?.method ?? null,
      receipt: receipt ?? null,
    } satisfies ReceiptData,
  };
}
