import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { CartProvider } from "@/features/cart/CartContext";
import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
} from "@/features/cart/cart.storage";
import { CartPage } from "@/pages/CartPage";

function renderCart(lines: readonly Record<string, unknown>[] = []) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ version: CART_STORAGE_VERSION, lines }),
  );

  return render(
    <CartProvider>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe("CartPage", () => {
  it("shows a purposeful empty state without checkout navigation", () => {
    renderCart();

    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to the shop" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("link", { name: /checkout/i })).not.toBeInTheDocument();
  });

  it("renders cart details and updates quantities and derived totals", async () => {
    const user = userEvent.setup();
    renderCart([{ productId: "everyday-backpack", quantity: 1 }]);

    expect(screen.getByRole("img", { name: /forest green canvas backpack/i })).toBeInTheDocument();
    expect(screen.getByText("€79.00 each")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Increase quantity of Everyday backpack",
      }),
    );

    expect(screen.getByLabelText("Quantity of Everyday backpack")).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByLabelText("Line total for Everyday backpack"),
    ).toHaveTextContent("€158.00");

    await user.click(
      screen.getByRole("button", { name: "Remove Everyday backpack" }),
    );
    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeInTheDocument();
  });

  it("disables incrementing at the quantity cap", () => {
    renderCart([{ productId: "desk-lamp", quantity: 99 }]);

    expect(
      screen.getByRole("button", {
        name: "Increase quantity of Adjustable desk lamp",
      }),
    ).toBeDisabled();
  });
});
