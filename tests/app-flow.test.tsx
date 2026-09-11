import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_CUSTOMER } from "../shared/orders";
import { App } from "@/app/App";
import { navigation } from "@/lib/navigation";
import {
  createCompletedOrder,
  createCompletedOrderItem,
  createJsonResponse,
} from "@/test/orders";

const completedOrder = createCompletedOrder({
  reference: "CG-FEED1234",
  createdAt: "2026-08-25T10:00:00.000Z",
  items: [
    createCompletedOrderItem({ quantity: 2 }),
    createCompletedOrderItem({
      productId: "travel-mug",
      productName: "Insulated travel mug",
      unitPriceCents: 2_895,
      quantity: 1,
    }),
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function parseRequestBody(requestInit: RequestInit | undefined): unknown {
  if (typeof requestInit?.body !== "string") {
    throw new Error("Expected the request body to be a JSON string.");
  }

  return JSON.parse(requestInit.body) as unknown;
}

describe("customer shopping flow", () => {
  it("saves a fixed demo order before clearing the cart", async () => {
    const assignSpy = vi.spyOn(navigation, "assign").mockImplementation(() => {});
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse(completedOrder, 201));
    vi.stubGlobal("fetch", fetchSpy);
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

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
    await user.click(screen.getByRole("link", { name: "Review checkout" }));
    expect(screen.getByRole("main")).toHaveFocus();
    expect(
      screen.queryByText("This is a public demo."),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Rs\s*186\.95/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    expect(screen.getByLabelText("Email address")).toHaveValue(DEMO_CUSTOMER.email);
    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        `/api/orders/${completedOrder.id}/payment/redirect`,
      );
    });
    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(parseRequestBody(fetchSpy.mock.calls[0]?.[1])).toMatchObject({
      demoCustomerId: DEMO_CUSTOMER.id,
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });
  });
});
