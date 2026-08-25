import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";

describe("customer shopping flow", () => {
  it("retains updated cart state while visiting the inert checkout", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: /^Add .+ to cart$/ })).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Add Everyday backpack to cart" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add Insulated travel mug to cart" }),
    );
    await user.click(screen.getByRole("link", { name: "Cart, 2 items" }));
    expect(screen.getByRole("main")).toHaveFocus();

    await user.click(
      screen.getByRole("button", {
        name: "Increase quantity of Everyday backpack",
      }),
    );
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Review checkout" }));
    expect(screen.getByRole("main")).toHaveFocus();
    expect(
      screen.getByText("Payments are not available in this demo."),
    ).toBeInTheDocument();
    expect(screen.getByText("€186.95")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to cart" }));
    expect(screen.getByLabelText("Quantity of Everyday backpack")).toHaveTextContent(
      "2",
    );
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();
  });
});
