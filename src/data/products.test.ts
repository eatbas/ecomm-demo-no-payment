import { describe, expect, it } from "vitest";

import { isProductId, productById, products } from "@/data/products";

describe("products", () => {
  it("contains exactly three valid products with unique identifiers", () => {
    expect(products).toHaveLength(3);
    expect(new Set(products.map(({ id }) => id)).size).toBe(3);

    for (const product of products) {
      expect(product.priceCents).toBeGreaterThan(0);
      expect(Number.isSafeInteger(product.priceCents)).toBe(true);
      expect(product.imagePath).toMatch(/^\/products\/[a-z-]+\.svg$/);
      expect(product.imageAlt.trim()).not.toBe("");
      expect(productById.get(product.id)).toBe(product);
    }
  });

  it("recognises only catalogue product identifiers", () => {
    expect(isProductId("everyday-backpack")).toBe(true);
    expect(isProductId("unknown-product")).toBe(false);
    expect(isProductId(null)).toBe(false);
  });
});
