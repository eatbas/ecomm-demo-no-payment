import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { products } from "@/data/products";
import { saveCart } from "@/features/cart/cart.storage";

function renderAppAt(pathname: string) {
  window.history.replaceState({}, "", pathname);
  return render(<App />);
}

describe("route heading outlines", () => {
  it("nests catalogue product headings beneath the product-list heading", () => {
    renderAppAt("/");

    expect(
      screen.getByRole("heading", { level: 1, name: "Useful goods, chosen to last." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Available products" }),
    ).toBeInTheDocument();

    for (const product of products) {
      expect(
        screen.getByRole("heading", { level: 3, name: product.name }),
      ).toBeInTheDocument();
    }
  });

  it("uses level-two headings for cart content and its summary", () => {
    saveCart(
      { lines: [{ productId: "everyday-backpack", quantity: 1 }] },
      window.localStorage,
    );
    renderAppAt("/cart");

    expect(
      screen.getByRole("heading", { level: 1, name: "Shopping cart" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Everyday backpack" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Cart summary" }),
    ).toBeInTheDocument();
  });

  it("uses a level-two heading for the checkout summary", () => {
    saveCart(
      { lines: [{ productId: "travel-mug", quantity: 1 }] },
      window.localStorage,
    );
    renderAppAt("/checkout");

    expect(
      screen.getByRole("heading", { level: 1, name: "Checkout" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Cart summary" }),
    ).toBeInTheDocument();
  });
});
