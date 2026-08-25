import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CartProvider, useCart } from "@/features/cart/CartContext";
import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
} from "@/features/cart/cart.storage";
import { seedStoredCart } from "@/test/cart";

function CartProbe() {
  const { itemCount, addItem } = useCart();

  return (
    <div>
      <output aria-label="Cart item count">{itemCount}</output>
      <button type="button" onClick={() => addItem("travel-mug")}>
        Add mug
      </button>
    </div>
  );
}

describe("CartProvider", () => {
  it("hydrates once from validated storage and persists subsequent changes", async () => {
    seedStoredCart([{ productId: "desk-lamp", quantity: 2 }]);
    const user = userEvent.setup();

    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>,
    );

    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Add mug" }));
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "")).toEqual({
        version: CART_STORAGE_VERSION,
        lines: [
          { productId: "desk-lamp", quantity: 2 },
          { productId: "travel-mug", quantity: 1 },
        ],
      });
    });
  });
});
