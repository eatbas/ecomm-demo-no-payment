import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/products/ProductCard";
import { products } from "@/data/products";
import { CartProvider } from "@/features/cart/CartContext";
import { MAX_CART_QUANTITY } from "@/features/cart/cart.types";
import { seedStoredCart } from "@/test/cart";

describe("ProductCard", () => {
  it("exposes product details and adds the product with the keyboard", async () => {
    const user = userEvent.setup();
    const product = products[0];

    render(
      <CartProvider>
        <ProductCard product={product} />
      </CartProvider>,
    );

    expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: product.imageAlt })).toHaveAttribute(
      "src",
      product.imagePath,
    );
    expect(screen.getByText("€79.00")).toBeInTheDocument();

    const addButton = screen.getByRole("button", {
      name: `Add ${product.name} to cart`,
    });
    await user.tab();
    expect(addButton).toHaveFocus();
    await user.keyboard("{Enter}");

    const status = screen.getByRole("status");
    expect(status).toHaveClass("sr-only");
    expect(status).toHaveTextContent(
      `${product.name} added to your cart. Quantity is now 1.`,
    );

    await user.keyboard("{Enter}");
    expect(status).toHaveTextContent(
      `${product.name} added to your cart. Quantity is now 2.`,
    );
  });

  it("disables adding a product when its cart line reaches the limit", () => {
    const product = products[0];
    seedStoredCart([
      { productId: product.id, quantity: MAX_CART_QUANTITY },
    ]);

    render(
      <CartProvider>
        <ProductCard product={product} />
      </CartProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: `${product.name} cart limit reached`,
      }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
