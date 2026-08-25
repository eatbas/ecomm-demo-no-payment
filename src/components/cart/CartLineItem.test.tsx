import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CartLineItem } from "@/components/cart/CartLineItem";
import { products } from "@/data/products";

describe("CartLineItem", () => {
  it("delegates each quantity action and exposes the current line values", async () => {
    const user = userEvent.setup();
    const onDecrement = vi.fn();
    const onIncrement = vi.fn();
    const onRemove = vi.fn();
    const product = products[0];

    render(
      <CartLineItem
        item={{ product, quantity: 2, lineTotalCents: product.priceCents * 2 }}
        titleRef={null}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        onRemove={onRemove}
      />,
    );

    expect(
      screen.getByLabelText(`Quantity of ${product.name}`),
    ).toHaveTextContent("2");
    expect(
      screen.getByLabelText(`Line total for ${product.name}`),
    ).toHaveTextContent("€158.00");

    await user.click(
      screen.getByRole("button", {
        name: `Decrease quantity of ${product.name}`,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Increase quantity of ${product.name}`,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: `Remove ${product.name}` }),
    );

    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onIncrement).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
