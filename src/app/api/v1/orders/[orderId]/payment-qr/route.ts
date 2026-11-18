import { createHash, timingSafeEqual } from "node:crypto";
import { failure } from "@/lib/api-response";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

function matchesToken(expectedHash: string, token: string) {
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const token = (request.headers.get("authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);

  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, access_token_hash, access_token_revoked_at, table_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error)
    return failure(
      "PAYMENT_QR_UNAVAILABLE",
      "QR pembayaran belum dapat diunduh.",
      503,
    );
  if (
    !order ||
    order.access_token_revoked_at ||
    !matchesToken(order.access_token_hash, token)
  )
    return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);

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

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("qr_url, attempt_number")
    .eq("order_id", order.id)
    .not("qr_url", "is", null)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError || !payment?.qr_url)
    return failure(
      "PAYMENT_QR_UNAVAILABLE",
      "QR pembayaran belum tersedia untuk diunduh.",
      404,
    );

  let qrUrl: URL;
  try {
    qrUrl = new URL(payment.qr_url);
  } catch {
    return failure(
      "PAYMENT_QR_UNAVAILABLE",
      "QR pembayaran belum tersedia untuk diunduh.",
      404,
    );
  }
  if (
    qrUrl.protocol !== "https:" ||
    !["api.sandbox.midtrans.com", "api.midtrans.com"].includes(qrUrl.hostname)
  )
    return failure(
      "PAYMENT_QR_UNAVAILABLE",
      "QR pembayaran belum tersedia untuk diunduh.",
      404,
    );

  try {
    const providerResponse = await fetch(qrUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const contentType = providerResponse.headers
      .get("content-type")
      ?.split(";")[0];
    if (!providerResponse.ok || !contentType?.startsWith("image/"))
      return failure(
        "PAYMENT_QR_UNAVAILABLE",
        "QR pembayaran belum dapat diunduh.",
        502,
      );
    return new Response(await providerResponse.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="qris-${order.id}.png"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return failure(
      "PAYMENT_QR_UNAVAILABLE",
      "QR pembayaran belum dapat diunduh. Coba lagi.",
      502,
    );
  }
}
