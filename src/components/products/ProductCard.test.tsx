import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import { ProductCard } from "@/components/products/ProductCard";
import { ToastRegion } from "@/components/toast/ToastRegion";
import { products } from "@/data/products";
import { MAX_CART_QUANTITY } from "@/features/cart/cart.types";
import { seedStoredCart } from "@/test/cart";
import type { Product } from "@/types/product";

function renderProductCard(product: Product) {
  render(
    <AppProviders>
      <ProductCard product={product} />
      <ToastRegion />
    </AppProviders>,
  );

  return screen.getByRole("status", { name: "Cart notifications" });
}

describe("ProductCard", () => {
  it("exposes product details and adds the product with the keyboard", async () => {
    const user = userEvent.setup();
    const product = products[0];

    const liveRegion = renderProductCard(product);

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

    expect(liveRegion).toHaveClass("sr-only");
    expect(liveRegion).toHaveTextContent(
      `Added to cart. ${product.name}, quantity 1`,
    );
    expect(screen.getByText(`${product.name}, quantity 1`)).toBeVisible();

    await user.keyboard("{Enter}");
    expect(liveRegion).toHaveTextContent(
      `Added to cart. ${product.name}, quantity 2`,
    );
    expect(screen.getByText(`${product.name}, quantity 2`)).toBeVisible();
    expect(
      screen.queryByText(`${product.name}, quantity 1`),
    ).not.toBeInTheDocument();
  });

  it("disables adding a product when its cart line reaches the limit", () => {
    const product = products[0];
    seedStoredCart([
      { productId: product.id, quantity: MAX_CART_QUANTITY },
    ]);

    const liveRegion = renderProductCard(product);

    expect(
      screen.getByRole("button", {
        name: `${product.name} cart limit reached`,
      }),
    ).toBeDisabled();
    expect(liveRegion).toBeEmptyDOMElement();
  });
});
