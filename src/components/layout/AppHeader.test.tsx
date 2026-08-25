import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AppHeader } from "@/components/layout/AppHeader";
import { CartProvider } from "@/features/cart/CartContext";

describe("AppHeader", () => {
  it("provides primary navigation and an accessible cart count", () => {
    render(
      <CartProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </CartProvider>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Common Goods" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });
});
