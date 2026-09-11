import { describe, expect, it } from "vitest";

import {
  CURRENCY,
  CURRENCY_LOCALE,
  formatCurrency,
} from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats whole and fractional rupee amounts using the Pakistani locale", () => {
    expect(CURRENCY).toBe("PKR");
    expect(CURRENCY_LOCALE).toBe("en-PK");
    expect(formatCurrency(7900)).toBe("Rs\u00a079.00");
    expect(formatCurrency(2895)).toBe("Rs\u00a028.95");
  });

  it("rejects values that cannot represent integer cents safely", () => {
    expect(() => formatCurrency(10.5)).toThrow(TypeError);
    expect(() => formatCurrency(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});
