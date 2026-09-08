import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { navigateTo } from "@/lib/navigation";
import {
  createJsonResponse,
  createOrderFixture,
  TEST_CUSTOMER,
} from "@/test/orders";

vi.mock("@/lib/navigation", () => ({ navigateTo: vi.fn() }));

const completedOrder = createOrderFixture({
  reference: "CG-FEED1234",
  createdAt: "2026-08-25T10:00:00.000Z",
  paymentStatus: "awaiting_payment",
  items: [
    {
      productId: "everyday-backpack",
      productName: "Everyday backpack",
      unitPriceCents: 7_900,
      quantity: 2,
      lineTotalCents: 15_800,
    },
    {
      productId: "travel-mug",
      productName: "Insulated travel mug",
      unitPriceCents: 2_895,
      quantity: 1,
      lineTotalCents: 2_895,
    },
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(navigateTo).mockClear();
});

function parseRequestBody(requestInit: RequestInit | undefined): unknown {
  if (typeof requestInit?.body !== "string") {
    throw new Error("Expected the request body to be a JSON string.");
  }

  return JSON.parse(requestInit.body) as unknown;
}

describe("customer shopping flow", () => {
  it("creates the order and hands off to JazzCash before clearing the cart", async () => {
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
    await waitFor(() => {
      expect(screen.getByRole("main")).toHaveFocus();
    });

    await user.click(
      screen.getByRole("button", {
        name: "Increase quantity of Everyday backpack",
      }),
    );
    await user.click(screen.getByRole("link", { name: "Review checkout" }));
    await waitFor(() => {
      expect(screen.getByRole("main")).toHaveFocus();
    });
    expect(
      screen.queryByText("This is a public demo."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Rs 186.95")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Full name"), TEST_CUSTOMER.fullName);
    await user.type(screen.getByLabelText("Email address"), TEST_CUSTOMER.email);
    await user.type(screen.getByLabelText("Phone number"), TEST_CUSTOMER.phone);
    await user.type(screen.getByLabelText("Address"), TEST_CUSTOMER.addressLine1);
    await user.type(screen.getByLabelText("Town or city"), TEST_CUSTOMER.city);
    await user.type(screen.getByLabelText("Postcode"), TEST_CUSTOMER.postcode);
    await user.type(screen.getByLabelText("Country"), TEST_CUSTOMER.country);
    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));

    expect(
      await screen.findByRole("link", { name: "Cart, 0 items" }),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(parseRequestBody(fetchSpy.mock.calls[0]?.[1])).toMatchObject({
      customer: TEST_CUSTOMER,
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });
    expect(navigateTo).toHaveBeenCalledWith(
      `/api/orders/${completedOrder.id}/payment/redirect`,
    );
  });
});
