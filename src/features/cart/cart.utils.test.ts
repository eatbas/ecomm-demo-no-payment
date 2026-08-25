import { describe, expect, it } from "vitest";

import { deriveCartTotals } from "@/features/cart/cart.utils";

describe("deriveCartTotals", () => {
  it("derives item count, line totals, and subtotal from catalogue prices", () => {
    const totals = deriveCartTotals({
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });

    expect(totals.itemCount).toBe(3);
    expect(totals.items).toEqual([
      expect.objectContaining({ quantity: 2, lineTotalCents: 15_800 }),
      expect.objectContaining({ quantity: 1, lineTotalCents: 2_895 }),
    ]);
    expect(totals.subtotalCents).toBe(18_695);
  });

  it("derives zero totals for an empty cart", () => {
    expect(deriveCartTotals({ lines: [] })).toEqual({
      items: [],
      itemCount: 0,
      subtotalCents: 0,
    });
  });
});
