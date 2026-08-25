import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/products/ProductCard";
import { products } from "@/data/products";
import { CartProvider } from "@/features/cart/CartContext";

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

    expect(screen.getByRole("status")).toHaveTextContent(
      `${product.name} added to your cart.`,
    );
  });
});
