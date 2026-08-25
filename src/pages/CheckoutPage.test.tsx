import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

import { CartProvider } from "@/features/cart/CartContext";
import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
} from "@/features/cart/cart.storage";
import { CheckoutPage } from "@/pages/CheckoutPage";

function seedCart(lines: readonly Record<string, unknown>[]) {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ version: CART_STORAGE_VERSION, lines }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CheckoutPage", () => {
  it("renders only a read-only summary and navigation without network activity", async () => {
    seedCart([
      { productId: "everyday-backpack", quantity: 2 },
      { productId: "travel-mug", quantity: 1 },
    ]);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    const { container } = render(
      <CartProvider>
        <MemoryRouter initialEntries={["/checkout"]}>
          <CheckoutPage />
        </MemoryRouter>
      </CartProvider>,
    );

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    expect(
      screen.getByText("Payments are not available in this demo."),
    ).toBeInTheDocument();
    expect(screen.getByText("€186.95")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input, select, textarea, iframe")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    await user.click(screen.getByRole("link", { name: "Back to cart" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects an empty cart to the cart page", () => {
    seedCart([]);

    render(
      <CartProvider>
        <MemoryRouter initialEntries={["/checkout"]}>
          <Routes>
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="cart" element={<p>Your cart route</p>} />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );

    expect(screen.getByText("Your cart route")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkout" })).not.toBeInTheDocument();
  });
});
