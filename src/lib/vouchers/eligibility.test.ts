import { describe, expect, it } from "vitest";
import { evaluateVoucher, normalizeVoucherCode, type VoucherRule } from "./eligibility";

const base: VoucherRule = {
  code: "HEMAT10", name: "Hemat 10", discount_type: "PERCENT", discount_value: 10,
  min_transaction: 10_000, max_discount: 5_000, quota: 2, used_count: 0,
  starts_on: "2026-01-01", ends_on: "2026-12-31", starts_time: "10:00", ends_time: "22:00", is_active: true,
};

describe("voucher eligibility", () => {
  it("normalizes a manual code by trimming and uppercasing", () => {
    expect(normalizeVoucherCode("  hemat10 ")).toBe("HEMAT10");
  });

  it("calculates a percentage discount and applies its cap", () => {
    const result = evaluateVoucher(base, [{ categoryId: "coffee", quantity: 2, unitPrice: 30_000 }], [], 0, new Date("2026-04-01T05:00:00.000Z"));
    expect(result).toMatchObject({ valid: true, eligibleSubtotal: 60_000, discountAmount: 5_000, totalAmount: 55_000 });
  });

  it("rounds percentage discounts down to whole rupiah", () => {
    const result = evaluateVoucher({ ...base, discount_value: 10, max_discount: null }, [{ categoryId: "coffee", quantity: 1, unitPrice: 15_019 }], [], 0, new Date("2026-04-01T05:00:00.000Z"));
    expect(result).toMatchObject({ valid: true, discountAmount: 1_501, totalAmount: 13_518 });
  });

  it("uses only scoped category subtotal for the minimum and discount", () => {
    const result = evaluateVoucher(base, [
      { categoryId: "coffee", quantity: 1, unitPrice: 20_000 },
      { categoryId: "food", quantity: 1, unitPrice: 100_000 },
    ], ["coffee"], 0, new Date("2026-04-01T05:00:00.000Z"));
    expect(result).toMatchObject({ valid: true, eligibleSubtotal: 20_000, discountAmount: 2_000, totalAmount: 118_000 });
  });

  it("rejects an exhausted quota and an out-of-window hour", () => {
    expect(evaluateVoucher(base, [{ categoryId: "coffee", quantity: 1, unitPrice: 20_000 }], [], 2, new Date("2026-04-01T05:00:00.000Z"))).toMatchObject({ valid: false });
    expect(evaluateVoucher(base, [{ categoryId: "coffee", quantity: 1, unitPrice: 20_000 }], [], 0, new Date("2026-04-01T02:00:00.000Z"))).toMatchObject({ valid: false });
  });

  it("supports a daily time window crossing midnight in Jakarta", () => {
    const overnight = { ...base, starts_time: "22:00", ends_time: "02:00" };
    expect(evaluateVoucher(overnight, [{ categoryId: "coffee", quantity: 1, unitPrice: 20_000 }], [], 0, new Date("2026-04-01T18:00:00.000Z")).valid).toBe(true);
    expect(evaluateVoucher(overnight, [{ categoryId: "coffee", quantity: 1, unitPrice: 20_000 }], [], 0, new Date("2026-04-01T20:00:00.000Z")).valid).toBe(false);
  });
});
