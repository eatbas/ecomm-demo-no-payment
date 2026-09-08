import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { CartProvider } from "@/features/cart/CartContext";
import { CartPage } from "@/pages/CartPage";
import { seedStoredCart } from "@/test/cart";

function renderCart(lines: Parameters<typeof seedStoredCart>[0] = []) {
  seedStoredCart(lines);
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

    expect(
      screen.getByRole("img", { name: /forest green canvas backpack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rs 79.00 each")).toBeInTheDocument();
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
    ).toHaveTextContent("Rs 158.00");
  });

  it("disables incrementing at the quantity cap", () => {
    renderCart([{ productId: "desk-lamp", quantity: 99 }]);

    expect(
      screen.getByRole("button", {
        name: "Increase quantity of Adjustable desk lamp",
      }),
    ).toBeDisabled();
  });

  it("announces decrement-removal and focuses the next cart line", async () => {
    const user = userEvent.setup();
    renderCart([
      { productId: "everyday-backpack", quantity: 1 },
      { productId: "travel-mug", quantity: 1 },
    ]);

    await user.click(
      screen.getByRole("button", {
        name: "Decrease quantity of Everyday backpack",
      }),
    );

    expect(screen.getByRole("status", { name: "Cart update" })).toHaveTextContent(
      "Everyday backpack removed from your cart.",
    );
    expect(
      screen.getByRole("heading", { name: "Insulated travel mug" }),
    ).toHaveFocus();
  });

  it("announces explicit removal and focuses the empty-cart heading", async () => {
    const user = userEvent.setup();
    renderCart([{ productId: "everyday-backpack", quantity: 2 }]);

    await user.click(
      screen.getByRole("button", { name: "Remove Everyday backpack" }),
    );

    expect(screen.getByRole("status", { name: "Cart update" })).toHaveTextContent(
      "Everyday backpack removed from your cart.",
    );
    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toHaveFocus();
  });

  it("announces clearing and focuses the empty-cart heading", async () => {
    const user = userEvent.setup();
    renderCart([
      { productId: "desk-lamp", quantity: 1 },
      { productId: "travel-mug", quantity: 1 },
    ]);

    await user.click(screen.getByRole("button", { name: "Clear cart" }));

    expect(screen.getByRole("status", { name: "Cart update" })).toHaveTextContent(
      "Cart cleared.",
    );
    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toHaveFocus();
  });
});
