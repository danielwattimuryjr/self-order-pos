import "server-only";
import type { ReceiptData } from "@/lib/receipts/receipt-data";
import { getServerEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";

type ClaimResult = { claimed: boolean; reason?: string; emailAddress?: string; attemptNumber?: number };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const formatMoney = (value: number) => new Intl.NumberFormat("id-ID").format(value);
function snapshotChoices(value: unknown, quantity = false) {
  if (!Array.isArray(value)) return "";
  return value.map((choice) => {
    if (!choice || typeof choice !== "object") return "";
    const row = choice as Record<string, unknown>;
    const prefix = quantity && Number(row.quantity) > 1 ? `${Number(row.quantity)} × ` : "";
    return `<li>${prefix}${escapeHtml(String(row.group ?? "Pilihan"))}: ${escapeHtml(String(row.option ?? ""))}</li>`;
  }).filter(Boolean).join("");
}

async function markEmailResult(orderId: string, sent: boolean, errorCode: string | null) {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("finish_receipt_email", {
    p_order_id: orderId,
    p_success: sent,
    p_error_code: errorCode,
  });
  return !error;
}

async function getReceiptData(orderId: string): Promise<ReceiptData | null> {
  const supabase = createServiceClient();
  const [{ data: order, error: orderError }, { data: items, error: itemError }, { data: payment, error: paymentError }, { data: receipt, error: receiptError }] = await Promise.all([
    supabase.from("orders").select("id, table_id, session_id, order_number, table_number_snapshot, customer_name, order_notes, payment_status, subtotal, discount_amount, total_amount, paid_at, access_token_hash, access_token_revoked_at, receipt_email, operational_date").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("menu_name_snapshot, quantity, item_note, unit_price_snapshot, line_total, variant_snapshot, addon_snapshot").eq("order_id", orderId).order("created_at").order("id"),
    supabase.from("payments").select("method").eq("order_id", orderId).eq("status", "PAID").order("attempt_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("receipts").select("email_status, email_sent_at").eq("order_id", orderId).maybeSingle(),
  ]);
  if (orderError || itemError || paymentError || receiptError || !order || !items || order.payment_status !== "PAID") return null;
  return { ...order, items, payment_method: payment?.method ?? null, receipt: receipt ?? null } as ReceiptData;
}

export async function sendReceiptEmail(orderId: string, accessTokenHash: string | null, automatic: boolean) {
  const supabase = createServiceClient();
  const { data: claimData, error: claimError } = await supabase.rpc("claim_receipt_email", {
    p_order_id: orderId,
    p_access_token_hash: accessTokenHash,
    p_automatic: automatic,
  });
  if (claimError) return { sent: false, reason: "EMAIL_STATE_UNAVAILABLE" };
  const claim = claimData as ClaimResult | null;
  if (!claim?.claimed) return { sent: false, reason: claim?.reason ?? "EMAIL_UNAVAILABLE" };

  let resultCode = "DELIVERY_FAILED";
  try {
    const env = getServerEnv();
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      resultCode = "EMAIL_PROVIDER_NOT_CONFIGURED";
      await markEmailResult(orderId, false, resultCode);
      return { sent: false, reason: resultCode };
    }
    const receipt = await getReceiptData(orderId);
    if (!receipt || !claim.emailAddress) {
      resultCode = "RECEIPT_UNAVAILABLE";
      await markEmailResult(orderId, false, resultCode);
      return { sent: false, reason: resultCode };
    }
    const itemRows = receipt.items.map((item) => `<li style="margin:0 0 16px"><strong>${item.quantity} × ${escapeHtml(item.menu_name_snapshot)} — Rp ${formatMoney(item.line_total)}</strong>${snapshotChoices(item.variant_snapshot)}${snapshotChoices(item.addon_snapshot, true)}${item.item_note ? `<div><small>Catatan: ${escapeHtml(item.item_note)}</small></div>` : ""}</li>`).join("");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `receipt/${orderId}/attempt/${claim.attemptNumber ?? 1}` },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [claim.emailAddress],
        subject: `Struk pesanan ${receipt.order_number}`,
        html: `<div style="font-family:Arial,sans-serif;color:#222"><h1>Struk pembayaran</h1><p>Pesanan <strong>${escapeHtml(receipt.order_number)}</strong> · Meja ${receipt.table_number_snapshot}</p>${receipt.customer_name ? `<p>Pelanggan: ${escapeHtml(receipt.customer_name)}</p>` : ""}<p>Waktu pembayaran: ${escapeHtml(new Date(receipt.paid_at ?? "").toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }))} WIB · QRIS</p><ul style="padding-left:20px">${itemRows}</ul>${receipt.order_notes ? `<p>Catatan pesanan: ${escapeHtml(receipt.order_notes)}</p>` : ""}<p>Subtotal: Rp ${formatMoney(receipt.subtotal)}</p>${receipt.discount_amount ? `<p>Diskon: −Rp ${formatMoney(receipt.discount_amount)}</p>` : ""}<p>Total dibayar: <strong>Rp ${formatMoney(receipt.total_amount)}</strong></p></div>`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      resultCode = `RESEND_HTTP_${response.status}`;
      await markEmailResult(orderId, false, resultCode);
      return { sent: false, reason: "DELIVERY_FAILED" };
    }
    const saved = await markEmailResult(orderId, true, null);
    if (!saved) return { sent: false, reason: "EMAIL_STATE_UNAVAILABLE" };
    return { sent: true, reason: null };
  } catch {
    // Keep the claim leased after an ambiguous network failure. A later manual retry
    // reuses the same Resend idempotency key for this attempt.
    return { sent: false, reason: "DELIVERY_FAILED" };
  }
}
