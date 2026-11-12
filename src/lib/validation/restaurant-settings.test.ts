import { describe, expect, it } from "vitest";
import { operatingHoursSchema, temporaryCloseSchema } from "./restaurant-settings";

describe("restaurant settings validation", () => {
  it("accepts same-daily hours including overnight hours", () => {
    expect(operatingHoursSchema.safeParse({ openingTime: "10:00", closingTime: "02:00" }).success).toBe(true);
  });

  it("rejects equal or malformed hours", () => {
    expect(operatingHoursSchema.safeParse({ openingTime: "10:00", closingTime: "10:00" }).success).toBe(false);
    expect(operatingHoursSchema.safeParse({ openingTime: "25:00", closingTime: "02:00" }).success).toBe(false);
  });

  it("requires a description for the other closure reason", () => {
    expect(temporaryCloseSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
    expect(temporaryCloseSchema.safeParse({ reason: "OTHER", otherReason: "" }).success).toBe(false);
    expect(temporaryCloseSchema.safeParse({ reason: "EMERGENCY" }).success).toBe(true);
  });
});
