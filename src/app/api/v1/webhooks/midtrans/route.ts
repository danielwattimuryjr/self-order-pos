import { createHash } from "node:crypto";
import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { getTransactionStatus, verifyNotificationSignature } from "@/lib/payments/midtrans";
import { publishPaymentStatus } from "@/lib/payments/realtime";
import { createServiceClient } from "@/lib/supabase/service";

const notificationSchema = z.object({
  order_id: z.string().min(1).max(50),
  transaction_id: z.string().min(1).max(100),
  transaction_status: z.string().min(1).max(30),
  status_code: z.string().regex(/^\d{3}$/),
  gross_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  signature_key: z.string().regex(/^[0-9a-f]{128}$/i),
});

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 32_000) return failure("INVALID_WEBHOOK", "Notifikasi tidak valid.", 400);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return failure("INVALID_WEBHOOK", "Notifikasi tidak valid.", 400); }
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) return failure("INVALID_WEBHOOK", "Notifikasi tidak valid.", 400);
  const notification = parsed.data;
  try {
    if (!verifyNotificationSignature({
      orderId: notification.order_id,
      statusCode: notification.status_code,
      grossAmount: notification.gross_amount,
      signature: notification.signature_key,
    })) return failure("INVALID_SIGNATURE", "Signature notifikasi tidak valid.", 401);

    const verified = await getTransactionStatus(notification.order_id);
    if (verified.order_id !== notification.order_id || verified.transaction_id !== notification.transaction_id || verified.status_code !== notification.status_code) {
      return failure("PROVIDER_STATUS_MISMATCH", "Status transaksi belum dapat diverifikasi.", 409);
    }
    const amount = Number(verified.gross_amount);
    const notifiedAmount = Number(notification.gross_amount);
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(notifiedAmount) || amount !== notifiedAmount) {
      return failure("INVALID_AMOUNT", "Nominal transaksi tidak valid.", 400);
    }
    const eventKey = `${verified.order_id}:${verified.transaction_id}:${verified.transaction_status}:${verified.fraud_status ?? ""}:${verified.status_code}`;
    const payloadHash = createHash("sha256").update(raw).digest("hex");
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("process_midtrans_payment_event", {
      p_event_key: eventKey,
      p_payload_hash: payloadHash,
      p_provider_order_id: verified.order_id,
      p_transaction_id: verified.transaction_id,
      p_provider_status: verified.transaction_status === "capture" && verified.fraud_status === "accept" ? "settlement" : verified.transaction_status,
      p_amount: amount,
    });
    if (error) return failure("WEBHOOK_PROCESSING_FAILED", "Notifikasi pembayaran belum dapat diproses.", 500);
    const { data: payment } = await supabase.from("payments").select("order_id").eq("provider_order_id", verified.order_id).maybeSingle();
    if (payment) {
      const { data: order } = await supabase.from("orders").select("access_token_hash").eq("id", payment.order_id).maybeSingle();
      if (order?.access_token_hash) await publishPaymentStatus(payment.order_id, order.access_token_hash);
    }
    return success(data, "Notifikasi pembayaran diproses.");
  } catch {
    return failure("PAYMENT_PROVIDER_UNAVAILABLE", "Status pembayaran belum dapat diverifikasi. Provider akan mengirim ulang notifikasi.", 503);
  }
}
