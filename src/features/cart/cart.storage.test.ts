import { describe, expect, it, vi } from "vitest";

import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
  loadCart,
  parseStoredCart,
  saveCart,
} from "@/features/cart/cart.storage";
import { EMPTY_CART, type CartState } from "@/features/cart/cart.types";

describe("cart storage", () => {
  it("parses a valid, versioned payload", () => {
    expect(
      parseStoredCart(
        JSON.stringify({
          version: CART_STORAGE_VERSION,
          lines: [
            { productId: "everyday-backpack", quantity: 2 },
            { productId: "travel-mug", quantity: 1 },
          ],
        }),
      ),
    ).toEqual({
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });
  });

  it.each([
    ["missing value", null],
    ["invalid JSON", "not-json"],
    ["wrong top-level shape", "[]"],
    ["stale version", '{"version":0,"lines":[]}'],
    ["extra top-level field", '{"version":1,"lines":[],"total":10}'],
    ["unknown product", '{"version":1,"lines":[{"productId":"unknown","quantity":1}]}'],
    ["zero quantity", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":0}]}'],
    ["negative quantity", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":-1}]}'],
    ["fractional quantity", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":1.5}]}'],
    ["excessive quantity", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":100}]}'],
    ["duplicate product", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":1},{"productId":"desk-lamp","quantity":2}]}'],
    ["extra line field", '{"version":1,"lines":[{"productId":"desk-lamp","quantity":1,"price":1}]}'],
  ])("rejects %s", (_caseName, payload) => {
    expect(parseStoredCart(payload)).toBe(EMPTY_CART);
  });

  it("loads and saves through the stable storage key", () => {
    const state: CartState = {
      lines: [{ productId: "desk-lamp", quantity: 3 }],
    };
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({ version: CART_STORAGE_VERSION, lines: state.lines }),
      ),
      setItem: vi.fn(),
    };

    expect(loadCart(storage)).toEqual(state);
    expect(storage.getItem).toHaveBeenCalledWith(CART_STORAGE_KEY);

    saveCart(state, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      CART_STORAGE_KEY,
      JSON.stringify({ version: CART_STORAGE_VERSION, lines: state.lines }),
    );
  });

  it("keeps cart operations safe when storage throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException("Blocked", "SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new DOMException("Full", "QuotaExceededError");
      }),
    };

    expect(loadCart(storage)).toBe(EMPTY_CART);
    expect(() => saveCart(EMPTY_CART, storage)).not.toThrow();
  });
});
