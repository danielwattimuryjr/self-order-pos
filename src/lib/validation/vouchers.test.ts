import { describe, expect, it } from "vitest";
import { voucherCreateSchema, voucherValidationRequestSchema } from "./vouchers";

const validVoucher = {
  code: " hemat10 ", name: "Hemat 10", discountType: "PERCENT", discountValue: 10,
  minTransaction: 0, maxDiscount: null, quota: null,
  startsOn: "2026-01-01", endsOn: "2026-12-31", startsTime: "10:00", endsTime: "22:00",
  isActive: true, categoryIds: [],
};

describe("voucher request schemas", () => {
  it("normalizes voucher code to trimmed uppercase", () => {
    expect(voucherCreateSchema.parse(validVoucher).code).toBe("HEMAT10");
  });

  it("rejects invalid percentage, reversed dates, and identical daily hours", () => {
    expect(voucherCreateSchema.safeParse({ ...validVoucher, discountValue: 101 }).success).toBe(false);
    expect(voucherCreateSchema.safeParse({ ...validVoucher, startsOn: "2026-12-31", endsOn: "2026-01-01" }).success).toBe(false);
    expect(voucherCreateSchema.safeParse({ ...validVoucher, startsTime: "10:00", endsTime: "10:00" }).success).toBe(false);
  });

  it("validates customer session, cart, and chosen option identifiers", () => {
    const id = "10000000-0000-4000-8000-000000000001";
    expect(voucherValidationRequestSchema.safeParse({ tableCode: id, sessionId: id, code: "HEMAT10", items: [{ menuId: id, quantity: 1 }] }).success).toBe(true);
    expect(voucherValidationRequestSchema.safeParse({ tableCode: id, sessionId: id, code: "HEMAT10", items: [{ menuId: "bad", quantity: 0 }] }).success).toBe(false);
  });
});
