import { createHash } from "node:crypto";
import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { cancelTransaction, getTransactionStatus, MidtransRequestError } from "@/lib/payments/midtrans";
import { publishPaymentStatus } from "@/lib/payments/realtime";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { adminCancellationSchema } from "@/lib/validation/phase7";

const paidAtProvider = (status: string, fraudStatus?: string) =>
  status === "settlement" || (status === "capture" && fraudStatus === "accept");

async function reconcilePaid(order: { id: string; access_token_hash: string }, provider: Awaited<ReturnType<typeof getTransactionStatus>>) {
  const service = createServiceClient();
  const { error } = await service.rpc("process_midtrans_payment_event", {
    p_event_key: `admin-cancel-check:${provider.order_id}:${provider.transaction_id}:${provider.transaction_status}`,
    p_payload_hash: createHash("sha256").update(JSON.stringify(provider)).digest("hex"),
    p_provider_order_id: provider.order_id,
    p_transaction_id: provider.transaction_id,
    p_provider_status: "settlement",
    p_amount: Number(provider.gross_amount),
  });
  if (error) return false;
  await publishPaymentStatus(order.id, order.access_token_hash);
  return true;
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  const parsed = adminCancellationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Alasan pembatalan tidak valid.", 422);

  const service = createServiceClient();
  const { data: order, error: orderError } = await service.from("orders")
    .select("id, order_number, order_status, payment_status, access_token_hash")
    .eq("id", orderId).maybeSingle();
  if (orderError) return failure("ORDER_UNAVAILABLE", "Pesanan belum dapat diperiksa.", 503);
  if (!order) return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  if (order.payment_status === "PAID" || order.order_status === "PAID") {
    return failure("ORDER_ALREADY_PAID", "Pesanan sudah dibayar dan tidak dapat dibatalkan.", 409);
  }
  if (order.payment_status !== "PENDING" || order.order_status !== "PENDING_PAYMENT") {
    return failure("ORDER_NOT_CANCELLABLE", "Pesanan sudah tidak dapat dibatalkan.", 409);
  }

  const { data: attempt, error: attemptError } = await service.from("payments")
    .select("provider_order_id").eq("order_id", orderId).eq("status", "PENDING")
    .order("attempt_number", { ascending: false }).limit(1).maybeSingle();
  if (attemptError) return failure("PAYMENT_STATUS_UNAVAILABLE", "Status pembayaran belum dapat diperiksa.", 503);
  if (attempt) {
    try {
      let provider = await getTransactionStatus(attempt.provider_order_id);
      if (paidAtProvider(provider.transaction_status, provider.fraud_status)) {
        if (!await reconcilePaid(order, provider)) return failure("PAYMENT_STATUS_UNAVAILABLE", "Pembayaran sukses, tetapi status pesanan belum dapat diperbarui.", 503);
        return failure("ORDER_ALREADY_PAID", "Pembayaran berhasil. Pesanan tidak dibatalkan.", 409);
      }
      if (provider.transaction_status === "pending") {
        try { await cancelTransaction(attempt.provider_order_id); } catch { /* Recheck determines the authoritative outcome. */ }
        provider = await getTransactionStatus(attempt.provider_order_id);
      }
      if (paidAtProvider(provider.transaction_status, provider.fraud_status)) {
        if (!await reconcilePaid(order, provider)) return failure("PAYMENT_STATUS_UNAVAILABLE", "Pembayaran sukses, tetapi status pesanan belum dapat diperbarui.", 503);
        return failure("ORDER_ALREADY_PAID", "Pembayaran berhasil. Pesanan tidak dibatalkan.", 409);
      }
      if (!["cancel", "expire", "deny", "failure"].includes(provider.transaction_status)) {
        return failure("PAYMENT_STATUS_UNAVAILABLE", "Midtrans masih memproses pembayaran. Pesanan belum dibatalkan.", 503);
      }
    } catch (error) {
      if (!(error instanceof MidtransRequestError && error.httpStatus === 404)) {
        return failure("PAYMENT_STATUS_UNAVAILABLE", "Status Midtrans belum dapat dipastikan. Pesanan belum dibatalkan.", 503);
      }
    }
  }

  const authenticated = await createClient();
  const { data, error } = await authenticated.rpc("admin_cancel_unpaid_order", {
    p_order_id: orderId,
    p_reason_code: parsed.data.reasonCode,
    p_reason_other: parsed.data.reasonOther ?? null,
  });
  if (error) {
    if (error.message === "ORDER_ALREADY_PAID") return failure("ORDER_ALREADY_PAID", "Pembayaran berhasil. Pesanan tidak dibatalkan.", 409);
    if (error.message === "ORDER_NOT_CANCELLABLE") return failure("ORDER_NOT_CANCELLABLE", "Pesanan sudah tidak dapat dibatalkan.", 409);
    if (error.code === "42501") return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure("ORDER_CANCEL_FAILED", "Pesanan belum dapat dibatalkan.", 500);
  }
  await publishPaymentStatus(order.id, order.access_token_hash);
  return success(data, "Pesanan dibatalkan dan dicatat di Audit Log.");
}
