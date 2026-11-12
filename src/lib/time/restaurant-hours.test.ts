import { describe, expect, it } from "vitest";
import { getRestaurantOperatingStatus } from "./restaurant-hours";

describe("getRestaurantOperatingStatus", () => {
  it("handles a normal daily schedule and next opening", () => {
    const settings = { opening_time: "10:00:00", closing_time: "22:00:00", temporary_closed: false, temporary_closed_at: null };
    expect(getRestaurantOperatingStatus(settings, new Date("2026-11-12T03:00:00Z")).status).toBe("OPEN");
    const outside = getRestaurantOperatingStatus(settings, new Date("2026-11-12T15:00:00Z"));
    expect(outside.status).toBe("OUTSIDE_HOURS");
    if (outside.status === "OUTSIDE_HOURS") expect(outside.nextOpeningAt).toBe("2026-11-13T03:00:00.000Z");
  });

  it("supports overnight hours", () => {
    const settings = { opening_time: "10:00:00", closing_time: "02:00:00", temporary_closed: false, temporary_closed_at: null };
    expect(getRestaurantOperatingStatus(settings, new Date("2026-11-12T17:00:00Z")).status).toBe("OPEN");
    expect(getRestaurantOperatingStatus(settings, new Date("2026-11-11T20:00:00Z")).status).toBe("OUTSIDE_HOURS");
  });

  it("keeps temporary close through the current opening and clears it at the next opening", () => {
    const settings = { opening_time: "10:00:00", closing_time: "22:00:00", temporary_closed: true, temporary_closed_at: "2026-11-11T08:00:00Z" };
    expect(getRestaurantOperatingStatus(settings, new Date("2026-11-12T02:59:00Z")).status).toBe("TEMPORARILY_CLOSED");
    expect(getRestaurantOperatingStatus(settings, new Date("2026-11-12T03:00:00Z")).status).toBe("OPEN");
  });

  it("reports unconfigured hours", () => {
    expect(getRestaurantOperatingStatus({ opening_time: null, closing_time: null, temporary_closed: false, temporary_closed_at: null }).status).toBe("NOT_CONFIGURED");
  });
});
