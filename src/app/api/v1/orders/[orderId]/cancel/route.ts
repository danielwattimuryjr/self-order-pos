import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { cancelTransaction, getTransactionStatus } from "@/lib/payments/midtrans";
import { publishPaymentStatus } from "@/lib/payments/realtime";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

const uuidSchema = z.uuid();
const bodySchema = z.object({ tableCode: z.uuid(), accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

function tokenMatches(hash: string, token: string) {
  const expected = Buffer.from(hash, "hex");
  const actual = createHash("sha256").update(token).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function paidStatus(status: string, fraudStatus?: string) {
  return status === "settlement" || (status === "capture" && fraudStatus === "accept");
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  if (!uuidSchema.safeParse(orderId).success) return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data pembatalan tidak valid.", 422);
  const limited = await checkPublicOrderRateLimit(request, parsed.data.tableCode);
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data: order, error } = await supabase.from("orders")
    .select("id, order_number, order_status, payment_status, access_token_hash, access_token_revoked_at, table_id")
    .eq("id", orderId).maybeSingle();
  if (error || !order || order.access_token_revoked_at || !tokenMatches(order.access_token_hash, parsed.data.accessToken)) {
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  }
  const { data: table, error: tableError } = await supabase.from("dining_tables").select("table_code").eq("id", order.table_id).maybeSingle();
  if (tableError || !table || table.table_code !== parsed.data.tableCode) {
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  }
  if (order.payment_status === "PAID") return success({ orderId, orderNumber: order.order_number, status: "PAID", paymentStatus: "PAID" }, "Pembayaran telah berhasil.");
  if (order.order_status !== "PENDING_PAYMENT") return success({ orderId, status: order.order_status, paymentStatus: order.payment_status }, "Pesanan sudah tidak menunggu pembayaran.");

  const { data: attempt } = await supabase.from("payments").select("id, provider_order_id, status")
    .eq("order_id", orderId).in("status", ["PENDING", "FAILED"]).order("attempt_number", { ascending: false }).limit(1).maybeSingle();
  if (attempt?.status === "PENDING") {
    try {
      let provider = await getTransactionStatus(attempt.provider_order_id);
      if (paidStatus(provider.transaction_status, provider.fraud_status)) {
        const { error: processError } = await supabase.rpc("process_midtrans_payment_event", {
          p_event_key: `cancel-check:${provider.order_id}:${provider.transaction_id}:${provider.transaction_status}`,
          p_payload_hash: createHash("sha256").update(JSON.stringify(provider)).digest("hex"),
          p_provider_order_id: provider.order_id, p_transaction_id: provider.transaction_id,
          p_provider_status: "settlement", p_amount: Number(provider.gross_amount),
        });
        if (processError) return failure("PAYMENT_STATUS_UNAVAILABLE", "Status pembayaran belum dapat dipastikan.", 503);
        await publishPaymentStatus(orderId, order.access_token_hash);
        return success({ orderId, orderNumber: order.order_number, status: "PAID", paymentStatus: "PAID" }, "Pembayaran telah berhasil.");
      }
      if (provider.transaction_status === "pending") {
        await cancelTransaction(attempt.provider_order_id);
        provider = await getTransactionStatus(attempt.provider_order_id);
      }
      if (paidStatus(provider.transaction_status, provider.fraud_status)) {
        const { error: processError } = await supabase.rpc("process_midtrans_payment_event", {
          p_event_key: `cancel-race:${provider.order_id}:${provider.transaction_id}:${provider.transaction_status}`,
          p_payload_hash: createHash("sha256").update(JSON.stringify(provider)).digest("hex"),
          p_provider_order_id: provider.order_id, p_transaction_id: provider.transaction_id,
          p_provider_status: "settlement", p_amount: Number(provider.gross_amount),
        });
        if (processError) return failure("PAYMENT_STATUS_UNAVAILABLE", "Status pembayaran belum dapat dipastikan.", 503);
        await publishPaymentStatus(orderId, order.access_token_hash);
        return success({ orderId, orderNumber: order.order_number, status: "PAID", paymentStatus: "PAID" }, "Pembayaran telah berhasil.");
      }
      if (!["cancel", "expire", "deny", "failure"].includes(provider.transaction_status)) {
        return failure("PAYMENT_STATUS_UNAVAILABLE", "Provider masih memeriksa pembayaran. Coba lagi beberapa saat.", 503);
      }
    } catch {
      return failure("PAYMENT_STATUS_UNAVAILABLE", "Status pembayaran belum dapat dipastikan. Coba lagi beberapa saat.", 503);
    }
  }

  const { data: cancelled, error: cancelError } = await supabase.rpc("cancel_unpaid_order", { p_order_id: orderId });
  if (cancelError) return failure("ORDER_CANCEL_FAILED", "Pesanan belum dapat dibatalkan.", 500);
  if (!cancelled) {
    const { data: current } = await supabase.from("orders").select("order_status, payment_status").eq("id", orderId).single();
    if (current?.payment_status === "PAID") return success({ orderId, orderNumber: order.order_number, status: "PAID", paymentStatus: "PAID" }, "Pembayaran telah berhasil.");
    return failure("ORDER_CANCEL_FAILED", "Pesanan sudah tidak dapat dibatalkan.", 409);
  }
  await publishPaymentStatus(orderId, order.access_token_hash);
  return success({ orderId, status: "CANCELLED", paymentStatus: "CANCELLED" }, "Pesanan dibatalkan.");
}
