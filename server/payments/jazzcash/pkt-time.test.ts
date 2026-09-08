// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addOneDay, formatPktTimestamp } from "./pkt-time.js";

describe("formatPktTimestamp", () => {
  it("shifts a UTC instant forward by five hours with no DST", () => {
    // 2026-08-23T07:00:00Z + 5h = 2026-08-23T12:00:00 PKT
    expect(formatPktTimestamp(new Date("2026-08-23T07:00:00.000Z"))).toBe(
      "20260823120000",
    );
  });

  it("rolls the date forward across midnight", () => {
    // 2026-08-23T20:30:00Z + 5h = 2026-08-24T01:30:00 PKT
    expect(formatPktTimestamp(new Date("2026-08-23T20:30:00.000Z"))).toBe(
      "20260824013000",
    );
  });

  it("pads single-digit month, day, hour, minute, and second components", () => {
    // 2026-01-02T00:01:02Z + 5h = 2026-01-02T05:01:02 PKT
    expect(formatPktTimestamp(new Date("2026-01-02T00:01:02.000Z"))).toBe(
      "20260102050102",
    );
  });
});

describe("addOneDay", () => {
  it("adds exactly 24 hours", () => {
    const start = new Date("2026-08-23T12:00:00.000Z");
    expect(addOneDay(start).toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });
});
