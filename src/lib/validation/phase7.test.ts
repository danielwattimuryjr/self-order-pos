import { describe, expect, it } from "vitest";
import { adminCancellationSchema, analyticsQuerySchema, transactionQuerySchema } from "./phase7";

describe("Phase 7 request validation", () => {
  it("requires explanatory text only for OTHER cancellation reasons", () => {
    expect(adminCancellationSchema.safeParse({ reasonCode: "OTHER" }).success).toBe(false);
    expect(adminCancellationSchema.safeParse({ reasonCode: "OTHER", reasonOther: "Kesalahan operasional" }).success).toBe(true);
    expect(adminCancellationSchema.safeParse({ reasonCode: "DUPLICATE_ORDER", reasonOther: "duplikat" }).success).toBe(false);
  });

  it("rejects reversed transaction date ranges", () => {
    expect(transactionQuerySchema.safeParse({ from: "2026-11-10", to: "2026-11-09" }).success).toBe(false);
    expect(transactionQuerySchema.safeParse({ from: "2026-11-09", to: "2026-11-10" }).success).toBe(true);
  });

  it("bounds analytics queries to 367 inclusive operational dates", () => {
    expect(analyticsQuerySchema.safeParse({ from: "2025-11-15", to: "2026-11-15", granularity: "week" }).success).toBe(true);
    expect(analyticsQuerySchema.safeParse({ from: "2025-11-13", to: "2026-11-15", granularity: "week" }).success).toBe(false);
  });
});
