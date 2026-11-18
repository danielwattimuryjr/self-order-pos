import { describe, expect, it } from "vitest";
import { getOperationalDate } from "./operational-date";

describe("getOperationalDate", () => {
  it("attributes after-midnight time before an overnight closing time to the previous date", () => {
    expect(
      getOperationalDate(new Date("2026-11-16T01:00:00+07:00"), {
        opening_time: "10:00:00",
        closing_time: "02:00:00",
      }),
    ).toBe("2026-11-15");
  });

  it("uses the calendar date after overnight closing", () => {
    expect(
      getOperationalDate(new Date("2026-11-16T03:00:00+07:00"), {
        opening_time: "10:00:00",
        closing_time: "02:00:00",
      }),
    ).toBe("2026-11-16");
  });

  it("falls back to the Jakarta calendar date when hours are not configured", () => {
    expect(
      getOperationalDate(new Date("2026-11-16T00:30:00+07:00"), {
        opening_time: null,
        closing_time: null,
      }),
    ).toBe("2026-11-16");
  });
});
