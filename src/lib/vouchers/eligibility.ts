export type VoucherRule = {
  code: string;
  name: string;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
  min_transaction: number;
  max_discount: number | null;
  quota: number | null;
  used_count: number;
  starts_on: string;
  ends_on: string;
  starts_time: string;
  ends_time: string;
  is_active: boolean;
};

export type VoucherCartItem = { categoryId: string; quantity: number; unitPrice: number };
export type VoucherEvaluation =
  | { valid: true; code: string; name: string; eligibleSubtotal: number; discountAmount: number; totalAmount: number }
  | { valid: false; reason: string };

const jakarta = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase();
}

function jakartaDateAndTime(now: Date) {
  const parts = Object.fromEntries(jakarta.formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function evaluateVoucher(
  voucher: VoucherRule,
  items: VoucherCartItem[],
  categoryIds: string[],
  activeReservations: number,
  now = new Date(),
): VoucherEvaluation {
  if (!voucher.is_active) return { valid: false, reason: "Voucher tidak aktif." };
  const local = jakartaDateAndTime(now);
  if (local.date < voucher.starts_on || local.date > voucher.ends_on) return { valid: false, reason: "Voucher belum berlaku atau masa berlakunya telah berakhir." };
  const startsTime = voucher.starts_time.slice(0, 5);
  const endsTime = voucher.ends_time.slice(0, 5);
  const isWithinDailyWindow = startsTime < endsTime
    ? local.time >= startsTime && local.time < endsTime
    : local.time >= startsTime || local.time < endsTime;
  if (!isWithinDailyWindow) return { valid: false, reason: "Voucher tidak berlaku pada jam ini." };

  const scoped = new Set(categoryIds);
  const eligibleItems = scoped.size ? items.filter((item) => scoped.has(item.categoryId)) : items;
  const eligibleSubtotal = eligibleItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  if (!Number.isSafeInteger(eligibleSubtotal)) return { valid: false, reason: "Nilai keranjang terlalu besar." };
  if (eligibleSubtotal < voucher.min_transaction) return { valid: false, reason: "Subtotal kategori yang memenuhi syarat belum mencapai minimum transaksi voucher." };
  if (voucher.quota !== null && voucher.used_count + activeReservations >= voucher.quota) return { valid: false, reason: "Kuota voucher telah habis." };

  const grossDiscount = voucher.discount_type === "PERCENT"
    ? Number((BigInt(eligibleSubtotal) * BigInt(voucher.discount_value)) / BigInt(100))
    : Math.min(eligibleSubtotal, voucher.discount_value);
  const cappedDiscount = voucher.max_discount === null ? grossDiscount : Math.min(grossDiscount, voucher.max_discount);
  const discountAmount = Math.min(eligibleSubtotal, cappedDiscount);
  return {
    valid: true,
    code: voucher.code,
    name: voucher.name,
    eligibleSubtotal,
    discountAmount,
    totalAmount: items.reduce((total, item) => total + item.quantity * item.unitPrice, 0) - discountAmount,
  };
}
