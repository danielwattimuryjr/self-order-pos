import { describe, expect, it } from "vitest";
import { hashOrderAccessToken } from "./order-access-token";

describe("order access token", () => {
  it("hashes the customer-held token to a fixed-length SHA-256 value", () => {
    const token = "a".repeat(43);
    const hash = hashOrderAccessToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
  });
});
