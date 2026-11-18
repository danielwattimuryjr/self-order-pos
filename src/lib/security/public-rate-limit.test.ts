import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { checkCatalogRateLimit } from "./catalog-rate-limit";
import { checkPublicOrderRateLimit } from "./public-order-rate-limit";

const tableCode = "46d77d6c-32b0-4dd2-b6e0-020001317344";

describe("public endpoint rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: true, retry_after_seconds: 60 }],
      error: null,
    });
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("applies independent IP and table counters to catalog requests", async () => {
    const request = new Request("http://localhost/api/v1/catalog", {
      headers: { "x-vercel-forwarded-for": "203.0.113.12" },
    });

    expect(await checkCatalogRateLimit(request, tableCode)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    for (const [, args] of mocks.rpc.mock.calls) {
      expect(args).toMatchObject({ p_limit: 60, p_window_seconds: 60 });
      expect(args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(args.p_key_hash).not.toContain("203.0.113.12");
      expect(args.p_key_hash).not.toContain(tableCode);
    }
  });

  it("fails closed with 429 and Retry-After when the order limit is exceeded", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 17 }],
      error: null,
    });
    const response = await checkPublicOrderRateLimit(
      new Request("http://localhost"),
      tableCode,
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("17");
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed with 503 when the database rate limiter is unavailable", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "unavailable" },
    });
    const response = await checkCatalogRateLimit(
      new Request("http://localhost"),
      tableCode,
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMIT_UNAVAILABLE" },
    });
  });
});
