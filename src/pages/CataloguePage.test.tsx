import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CataloguePage } from "@/pages/CataloguePage";
import { CartProvider } from "@/features/cart/CartContext";

describe("CataloguePage", () => {
  it("renders the complete three-product catalogue as a semantic list", () => {
    render(
      <CartProvider>
        <CataloguePage />
      </CartProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Useful goods, chosen to last." }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getAllByRole("button", { name: /^Add .+ to cart$/ }),
    ).toHaveLength(3);
  });
});
