import { createHash, timingSafeEqual } from "node:crypto";
import { failure, success } from "@/lib/api-response";
import {
  cancelTransaction,
  getTransactionStatus,
} from "@/lib/payments/midtrans";
import { publishPaymentStatus } from "@/lib/payments/realtime";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

function matchesToken(expectedHash: string, token: string) {
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// 4c2302a1-e4ff-47a8-8e17-ca60731eeb22
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 1", 404);
  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_status, payment_status, total_amount, expires_at, paid_at, access_token_hash, access_token_revoked_at, table_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("[payment-status] order lookup failed", { code: error.code });
    return failure(
      "PAYMENT_STATUS_UNAVAILABLE",
      "Status pesanan belum dapat diperiksa. Coba beberapa saat lagi.",
      503,
    );
  }
  if (
    !order ||
    order.access_token_revoked_at ||
    !matchesToken(order.access_token_hash, token)
  ) {
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 2", 404);
  }
  const { data: table } = await supabase
    .from("dining_tables")
    .select("table_code")
    .eq("id", order.table_id)
    .maybeSingle();
  const limited = await checkPublicOrderRateLimit(
    request,
    table?.table_code ?? order.id,
  );
  if (limited) return limited;

  if (
    order.payment_status === "PENDING" &&
    new Date(order.expires_at).getTime() <= Date.now()
  ) {
    const { data: attempt } = await supabase
      .from("payments")
      .select("id, provider_order_id")
      .eq("order_id", order.id)
      .in("status", ["PENDING", "FAILED"])
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    try {
      if (attempt) {
        let provider = await getTransactionStatus(attempt.provider_order_id);
        if (provider.transaction_status === "pending") {
          await cancelTransaction(attempt.provider_order_id);
          provider = await getTransactionStatus(attempt.provider_order_id);
        }
        if (
          provider.transaction_status === "settlement" ||
          (provider.transaction_status === "capture" &&
            (provider as unknown as { fraud_status?: string }).fraud_status ===
              "accept")
        ) {
          const { error: processError } = await supabase.rpc(
            "process_midtrans_payment_event",
            {
              p_event_key: `reconcile:${provider.order_id}:${provider.transaction_id}:${provider.transaction_status}`,
              p_payload_hash: createHash("sha256")
                .update(JSON.stringify(provider))
                .digest("hex"),
              p_provider_order_id: provider.order_id,
              p_transaction_id: provider.transaction_id,
              p_provider_status: "settlement",
              p_amount: Number(provider.gross_amount),
            },
          );
          if (processError)
            return failure(
              "PAYMENT_STATUS_UNAVAILABLE",
              "Status pembayaran belum dapat diperbarui.",
              503,
            );
          await publishPaymentStatus(order.id, order.access_token_hash);
        } else if (
          ["expire", "cancel", "deny", "failure"].includes(
            provider.transaction_status,
          )
        ) {
          await supabase.rpc("expire_unpaid_order", {
            p_order_id: order.id,
            p_payment_id: attempt.id,
          });
          await publishPaymentStatus(order.id, order.access_token_hash);
        } else {
          return failure(
            "PAYMENT_STATUS_UNAVAILABLE",
            "Provider masih memproses pembayaran. Status akan diperiksa kembali.",
            503,
          );
        }
      } else {
        await supabase.rpc("expire_unpaid_order", {
          p_order_id: order.id,
          p_payment_id: null,
        });
        await publishPaymentStatus(order.id, order.access_token_hash);
      }
    } catch {
      return failure(
        "PAYMENT_STATUS_UNAVAILABLE",
        "Status pembayaran sedang diverifikasi oleh provider. Coba beberapa saat lagi.",
        503,
      );
    }
  }

  const [{ data: freshOrder }, { data: latestAttempt }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_status, payment_status, total_amount, expires_at, paid_at")
      .eq("id", order.id)
      .single(),
    supabase
      .from("payments")
      .select("method, status, paid_at, qr_url, expires_at")
      .eq("order_id", order.id)
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return success(
    {
      id: order.id,
      orderNumber: order.order_number,
      status: freshOrder?.order_status ?? order.order_status,
      paymentStatus: freshOrder?.payment_status ?? order.payment_status,
      totalAmount: Number(freshOrder?.total_amount ?? order.total_amount),
      expiresAt: freshOrder?.expires_at ?? order.expires_at,
      paidAt: freshOrder?.paid_at ?? order.paid_at,
      paymentMethod: latestAttempt?.method ?? null,
      attemptStatus: latestAttempt?.status ?? null,
      qrUrl: latestAttempt?.qr_url ?? null,
      paymentExpiresAt: latestAttempt?.expires_at ?? null,
    },
    "Status pembayaran tersedia.",
  );
}
