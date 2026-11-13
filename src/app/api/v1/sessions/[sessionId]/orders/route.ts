import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { hashOrderAccessToken } from "@/lib/security/order-access-token";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { createOrderRequestSchema } from "@/lib/validation/vouchers";

const idSchema = z.uuid();

const publicErrors: Record<string, { code: string; message: string; status: number }> = {
  SESSION_EXPIRED: { code: "SESSION_EXPIRED", message: "Sesi meja telah berakhir. Pindai ulang QR meja.", status: 409 },
  RESTAURANT_NOT_CONFIGURED: { code: "RESTAURANT_NOT_CONFIGURED", message: "Jam operasional belum diatur. Pesanan belum dapat dibuat.", status: 409 },
  RESTAURANT_TEMPORARILY_CLOSED: { code: "RESTAURANT_TEMPORARILY_CLOSED", message: "Restoran sedang tutup sementara.", status: 409 },
  OUTSIDE_OPERATING_HOURS: { code: "OUTSIDE_OPERATING_HOURS", message: "Pesanan baru hanya dapat dibuat pada jam operasional.", status: 409 },
  MENU_UNAVAILABLE: { code: "MENU_UNAVAILABLE", message: "Ada menu yang sudah tidak tersedia. Perbarui keranjang.", status: 409 },
  VARIANT_REQUIRED: { code: "INVALID_CART", message: "Lengkapi pilihan varian sebelum checkout.", status: 422 },
  VARIANT_UNAVAILABLE: { code: "INVALID_CART", message: "Pilihan varian berubah. Periksa kembali keranjang.", status: 409 },
  ADDON_SELECTION_COUNT_INVALID: { code: "INVALID_CART", message: "Pilihan add-on berubah. Periksa kembali keranjang.", status: 409 },
  ADDON_UNAVAILABLE: { code: "INVALID_CART", message: "Pilihan add-on berubah. Periksa kembali keranjang.", status: 409 },
  VOUCHER_INVALID: { code: "VOUCHER_INVALID", message: "Voucher tidak aktif atau tidak ditemukan.", status: 422 },
  VOUCHER_OUTSIDE_DATES: { code: "VOUCHER_INVALID", message: "Voucher belum berlaku atau masa berlakunya telah berakhir.", status: 422 },
  VOUCHER_OUTSIDE_HOURS: { code: "VOUCHER_INVALID", message: "Voucher tidak berlaku pada jam ini.", status: 422 },
  VOUCHER_MINIMUM_NOT_MET: { code: "VOUCHER_MINIMUM_NOT_MET", message: "Subtotal kategori yang memenuhi syarat belum mencapai minimum transaksi voucher.", status: 422 },
  VOUCHER_QUOTA_EXHAUSTED: { code: "VOUCHER_QUOTA_EXHAUSTED", message: "Kuota voucher baru saja habis. Hapus voucher atau periksa kembali.", status: 409 },
};

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!idSchema.safeParse(sessionId).success) return failure("SESSION_EXPIRED", "Sesi meja tidak valid.", 409);
  const parsed = createOrderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data checkout tidak valid.", 422);
  const limited = await checkPublicOrderRateLimit(request, parsed.data.tableCode);
  if (limited) return limited;

  const accessToken = parsed.data.accessToken;
  const accessTokenHash = hashOrderAccessToken(accessToken);
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("create_customer_order", {
    p_table_code: parsed.data.tableCode,
    p_session_id: sessionId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_items: parsed.data.items,
    p_voucher_code: parsed.data.voucherCode ?? null,
    p_customer_name: parsed.data.customerName,
    p_receipt_email: parsed.data.receiptEmail ?? null,
    p_order_notes: parsed.data.orderNotes,
    p_access_token_hash: accessTokenHash,
  });
  if (error) {
    if (error.message === "IDEMPOTENCY_CONFLICT") return failure("IDEMPOTENCY_CONFLICT", "Checkout dengan kunci ini sudah digunakan untuk token lain. Muat ulang keranjang dan coba kembali.", 409);
    const mapped = publicErrors[error.message];
    if (mapped) return failure(mapped.code, mapped.message, mapped.status);
    if (error.code === "P0002") return failure("SESSION_EXPIRED", "Sesi meja telah berakhir. Pindai ulang QR meja.", 409);
    if (error.code === "22023" || error.code === "22003") return failure("INVALID_CART", "Isi keranjang berubah atau tidak valid. Periksa kembali pesanan.", 422);
    return failure("ORDER_CREATE_FAILED", "Pesanan belum dapat dibuat. Coba beberapa saat lagi.", 500);
  }
  if (!data) return failure("ORDER_CREATE_FAILED", "Pesanan belum dapat dibuat. Coba beberapa saat lagi.", 500);
  return success({ ...data, accessToken }, "Pesanan dibuat dan menunggu pembayaran.");
}
