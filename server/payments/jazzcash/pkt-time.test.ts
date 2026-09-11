// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addOneDay, formatPktTimestamp } from "./pkt-time.js";

describe("PKT timestamp formatting", () => {
  it("formats UTC dates into Pakistan Standard Time (UTC+05:00)", () => {
    // 2026-09-11 05:00:00 UTC -> 2026-09-11 10:00:00 PKT
    const date = new Date("2026-09-11T05:00:00.000Z");
    expect(formatPktTimestamp(date)).toBe("20260911100000");
  });

  it("handles day rollover across midnight in UTC+5", () => {
    // 2026-09-11 20:30:15 UTC -> 2026-09-12 01:30:15 PKT
    const date = new Date("2026-09-11T20:30:15.000Z");
    expect(formatPktTimestamp(date)).toBe("20260912013015");
  });

  it("adds exactly 24 hours for transaction expiry", () => {
    const start = new Date("2026-09-11T12:00:00.000Z");
    const expiry = addOneDay(start);

    expect(formatPktTimestamp(start)).toBe("20260911170000");
    expect(formatPktTimestamp(expiry)).toBe("20260912170000");
  });
});
