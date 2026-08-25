import { describe, expect, it } from "vitest";

import {
  CURRENCY,
  CURRENCY_LOCALE,
  formatCurrency,
} from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats whole and fractional euro amounts using the British locale", () => {
    expect(CURRENCY).toBe("EUR");
    expect(CURRENCY_LOCALE).toBe("en-GB");
    expect(formatCurrency(7900)).toBe("€79.00");
    expect(formatCurrency(2895)).toBe("€28.95");
  });

  it("rejects values that cannot represent integer cents safely", () => {
    expect(() => formatCurrency(10.5)).toThrow(TypeError);
    expect(() => formatCurrency(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});
