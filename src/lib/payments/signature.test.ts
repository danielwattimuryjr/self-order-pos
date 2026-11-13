import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMidtransSignature } from "./signature";

describe("Midtrans notification signature", () => {
  const values = { orderId: "ORD-131126001-A1", statusCode: "200", grossAmount: "12500.00", serverKey: "local-test-placeholder" };
  const signature = createHash("sha512").update(`${values.orderId}${values.statusCode}${values.grossAmount}${values.serverKey}`).digest("hex");

  it("accepts a signature matching the provider formula", () => {
    expect(verifyMidtransSignature({ ...values, signature })).toBe(true);
  });

  it("rejects a mismatched signature and malformed length", () => {
    expect(verifyMidtransSignature({ ...values, signature: "0".repeat(128) })).toBe(false);
    expect(verifyMidtransSignature({ ...values, signature: "abcd" })).toBe(false);
  });
});
