import { describe, expect, it } from "vitest";
import { formatOperationalOrderNumber } from "./order-number";

describe("formatOperationalOrderNumber", () => {
  it("formats the operational date with a minimum three-digit sequence", () => {
    expect(formatOperationalOrderNumber("2026-04-09", 3)).toBe("ORD-090426003");
  });

  it("expands the sequence after 999", () => {
    expect(formatOperationalOrderNumber("2026-04-09", 1_000)).toBe("ORD-0904261000");
  });

  it("rejects invalid date or sequence values", () => {
    expect(() => formatOperationalOrderNumber("09-04-2026", 1)).toThrow();
    expect(() => formatOperationalOrderNumber("2026-04-09", 0)).toThrow();
  });
});
