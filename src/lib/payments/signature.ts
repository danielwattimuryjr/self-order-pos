import { createHash, timingSafeEqual } from "node:crypto";

export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signature: string;
}) {
  const expected = createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${input.serverKey}`)
    .digest();
  const actual = Buffer.from(input.signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
