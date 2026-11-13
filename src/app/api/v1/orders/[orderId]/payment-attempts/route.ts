import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { hashOrderAccessToken } from "@/lib/security/order-access-token";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createQrisCharge,
  MidtransRequestError,
} from "@/lib/payments/midtrans";

const paramsSchema = z.uuid();
const requestSchema = z.object({
  tableCode: z.uuid(),
  accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  idempotencyKey: z.uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  if (!paramsSchema.safeParse(orderId).success)
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 1", 404);
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return failure("VALIDATION_ERROR", "Data pembayaran tidak valid.", 422);
  const limited = await checkPublicOrderRateLimit(
    request,
    parsed.data.tableCode,
  );
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data: orderOwner, error: orderOwnerError } = await supabase
    .from("orders")
    .select("id, table_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderOwnerError) {
    console.error("[payment-attempts] order lookup failed", {
      code: orderOwnerError.code,
    });
    return failure(
      "PAYMENT_ATTEMPT_FAILED",
      "Pesanan belum dapat diperiksa. Coba beberapa saat lagi.",
      500,
    );
  }
  if (!orderOwner) {
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 2", 404);
  }
  const { data: orderTable, error: orderTableError } = await supabase
    .from("dining_tables")
    .select("table_code")
    .eq("id", orderOwner.table_id)
    .maybeSingle();
  if (
    orderTableError ||
    !orderTable ||
    orderTable.table_code !== parsed.data.tableCode
  ) {
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 3", 404);
  }
  const tokenHash = hashOrderAccessToken(parsed.data.accessToken);
  const { data: attempt, error } = await supabase.rpc(
    "create_payment_attempt",
    {
      p_order_id: orderId,
      p_access_token_hash: tokenHash,
      p_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error) {
    if (error.message === "ORDER_NOT_FOUND")
      return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan. 4", 404);
    if (error.message === "ORDER_EXPIRED")
      return failure(
        "ORDER_EXPIRED",
        "Batas pembayaran pesanan telah berakhir.",
        409,
      );
    if (error.message === "ORDER_NOT_PAYABLE")
      return failure(
        "ORDER_NOT_PAYABLE",
        "Pesanan tidak lagi menunggu pembayaran.",
        409,
      );
    return failure(
      "PAYMENT_ATTEMPT_FAILED",
      "Percobaan pembayaran belum dapat dibuat.",
      500,
    );
  }
  if (!attempt)
    return failure(
      "PAYMENT_ATTEMPT_FAILED",
      "Percobaan pembayaran belum dapat dibuat.",
      500,
    );
  if (attempt.status === "PAID")
    return success(
      { orderId, status: "PAID", paymentStatus: "PAID" },
      "Pembayaran telah berhasil.",
    );
  if (attempt.qr_url)
    return success(
      {
        orderId,
        paymentAttemptId: attempt.id,
        qrUrl: attempt.qr_url,
        expiresAt: attempt.expires_at,
        status: attempt.status,
      },
      "QRIS siap dibayar.",
    );
  if (attempt.status !== "PENDING")
    return success(
      {
        orderId,
        paymentAttemptId: attempt.id,
        status: attempt.status,
        expiresAt: attempt.expires_at,
      },
      "Percobaan pembayaran sebelumnya telah selesai.",
    );
  if (attempt.existing)
    return failure(
      "PAYMENT_QR_PENDING",
      "QRIS sedang dipersiapkan. Periksa kembali status pembayaran beberapa saat lagi.",
      409,
    );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("customer_name, receipt_email")
    .eq("id", orderId)
    .single();
  if (orderError)
    return failure(
      "PAYMENT_ATTEMPT_FAILED",
      "Rincian pesanan belum dapat dimuat.",
      500,
    );
  try {
    const charge = await createQrisCharge({
      providerOrderId: attempt.provider_order_id,
      amount: Number(attempt.amount),
      itemDetails: [
        {
          id: attempt.order_id,
          price: Number(attempt.amount),
          quantity: 1,
          name: `Pesanan ${attempt.provider_order_id}`,
        },
      ],
      customerName: order.customer_name,
      customerEmail: order.receipt_email,
      expiresAt: attempt.expires_at,
    });
    const qrUrl = charge.actions?.find(
      (action) => action.name === "generate-qr-code",
    )?.url;
    if (!qrUrl)
      return failure(
        "QRIS_UNAVAILABLE",
        "Provider belum mengembalikan kode QR. Coba ulangi pembayaran.",
        502,
      );
    const { error: saveError } = await supabase.rpc("save_payment_qr", {
      p_payment_id: attempt.id,
      p_transaction_id: charge.transaction_id,
      p_qr_url: qrUrl,
      p_provider_response_safe: {
        transactionStatus: charge.transaction_status,
        expiryTime: charge.expiry_time ?? null,
      },
    });
    if (saveError)
      return failure(
        "PAYMENT_ATTEMPT_FAILED",
        "Kode QR belum dapat disimpan.",
        500,
      );
    return success(
      {
        orderId,
        paymentAttemptId: attempt.id,
        qrUrl,
        expiresAt: attempt.expires_at,
        status: "PENDING",
      },
      "QRIS siap dibayar.",
    );
  } catch (error) {
    if (error instanceof MidtransRequestError) {
      console.error("[payment-attempts] Midtrans QRIS request failed", {
        code: error.code,
        httpStatus: error.httpStatus,
        contentType: error.contentType,
        server: error.server,
        providerErrorCategory: error.providerErrorCategory,
        responseBodyKeys: error.responseBodyKeys,
        providerErrorDetail: error.providerErrorDetail,
      });
    } else {
      console.error("[payment-attempts] Midtrans QRIS request failed", {
        code: "MIDTRANS_UNEXPECTED_ERROR",
      });
    }
    return failure(
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "Layanan pembayaran belum dapat dihubungi. Coba beberapa saat lagi.",
      502,
    );
  }
}
