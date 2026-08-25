import { describe, expect, it } from "vitest";

import { cartReducer } from "@/features/cart/cart.reducer";
import {
  EMPTY_CART,
  MAX_CART_QUANTITY,
  type CartState,
} from "@/features/cart/cart.types";

describe("cartReducer", () => {
  it("adds a new line and increments an existing line immutably", () => {
    const added = cartReducer(EMPTY_CART, {
      type: "add",
      productId: "everyday-backpack",
    });
    const incremented = cartReducer(added, {
      type: "add",
      productId: "everyday-backpack",
    });

    expect(added).toEqual({
      lines: [{ productId: "everyday-backpack", quantity: 1 }],
    });
    expect(incremented).toEqual({
      lines: [{ productId: "everyday-backpack", quantity: 2 }],
    });
    expect(added.lines[0]?.quantity).toBe(1);
  });

  it("increments and decrements existing lines", () => {
    const initial: CartState = {
      lines: [{ productId: "desk-lamp", quantity: 2 }],
    };

    const incremented = cartReducer(initial, {
      type: "increment",
      productId: "desk-lamp",
    });
    const decremented = cartReducer(incremented, {
      type: "decrement",
      productId: "desk-lamp",
    });

    expect(incremented.lines[0]?.quantity).toBe(3);
    expect(decremented).toEqual(initial);
  });

  it("removes a line when its quantity is decremented from one", () => {
    const state: CartState = {
      lines: [
        { productId: "desk-lamp", quantity: 1 },
        { productId: "travel-mug", quantity: 2 },
      ],
    };

    expect(
      cartReducer(state, { type: "decrement", productId: "desk-lamp" }),
    ).toEqual({ lines: [{ productId: "travel-mug", quantity: 2 }] });
  });

  it("never increments a quantity beyond the upper boundary", () => {
    const state: CartState = {
      lines: [
        { productId: "everyday-backpack", quantity: MAX_CART_QUANTITY },
      ],
    };

    expect(
      cartReducer(state, {
        type: "increment",
        productId: "everyday-backpack",
      }),
    ).toBe(state);
    expect(
      cartReducer(state, { type: "add", productId: "everyday-backpack" }),
    ).toBe(state);
  });

  it("removes one line or clears all lines", () => {
    const state: CartState = {
      lines: [
        { productId: "desk-lamp", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    };

    expect(
      cartReducer(state, { type: "remove", productId: "desk-lamp" }),
    ).toEqual({ lines: [{ productId: "travel-mug", quantity: 1 }] });
    expect(cartReducer(state, { type: "clear" })).toEqual(EMPTY_CART);
  });

  it("returns the same state for operations on absent lines", () => {
    expect(
      cartReducer(EMPTY_CART, {
        type: "increment",
        productId: "travel-mug",
      }),
    ).toBe(EMPTY_CART);
    expect(
      cartReducer(EMPTY_CART, {
        type: "decrement",
        productId: "travel-mug",
      }),
    ).toBe(EMPTY_CART);
    expect(
      cartReducer(EMPTY_CART, { type: "remove", productId: "travel-mug" }),
    ).toBe(EMPTY_CART);
    expect(cartReducer(EMPTY_CART, { type: "clear" })).toBe(EMPTY_CART);
  });
});
