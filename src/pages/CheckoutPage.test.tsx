import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router";

import { DEMO_CUSTOMER, type CompletedOrder } from "../../shared/orders";
import { CartProvider, useCart } from "@/features/cart/CartContext";
import { navigation } from "@/lib/navigation";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { seedStoredCart } from "@/test/cart";
import {
  createCompletedOrder,
  createCompletedOrderItem,
  createJsonResponse,
} from "@/test/orders";

const completedOrder = createCompletedOrder({
  reference: "CG-DEAD1234",
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

function CartItemCount() {
  const { itemCount } = useCart();

  return <output aria-label="Cart item count">{itemCount}</output>;
}

function CartMutationRoute() {
  const { addItem, incrementItem } = useCart();

  return (
    <div>
      <p>Your cart route</p>
      <button type="button" onClick={() => addItem("desk-lamp")}>
        Add later cart item
      </button>
      <button type="button" onClick={() => incrementItem("everyday-backpack")}>
        Change submitted quantity
      </button>
      <Link to="/checkout">Return to checkout</Link>
    </div>
  );
}

function renderCheckout(
  lines: Parameters<typeof seedStoredCart>[0] = [
    { productId: "everyday-backpack", quantity: 2 },
    { productId: "travel-mug", quantity: 1 },
  ],
) {
  seedStoredCart(lines);
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartItemCount />
        <Link to="/cart">Leave checkout</Link>
        <Routes>
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="cart" element={<CartMutationRoute />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

function successfulResponse(order: CompletedOrder = completedOrder): Response {
  return createJsonResponse(order, 201);
}

function parseRequestBody(requestInit: RequestInit | undefined): Record<string, unknown> {
  if (typeof requestInit?.body !== "string") {
    throw new Error("Expected the request body to be a JSON string.");
  }

  const parsedBody: unknown = JSON.parse(requestInit.body);
  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    Array.isArray(parsedBody)
  ) {
    throw new Error("Expected the request body to contain a JSON object.");
  }

  return parsedBody as Record<string, unknown>;
}

let assignSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  assignSpy = vi.spyOn(navigation, "assign").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CheckoutPage", () => {
  it("fills only the fixed synthetic account into labelled read-only fields", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Demo delivery details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payment" })).toBeInTheDocument();
    expect(
      screen.queryByText("This is a public demo."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Email address")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));

    expect(screen.getByLabelText("Full name")).toHaveValue(DEMO_CUSTOMER.fullName);
    expect(screen.getByLabelText("Email address")).toHaveValue(DEMO_CUSTOMER.email);
    expect(screen.getByLabelText("Phone number")).toHaveValue(DEMO_CUSTOMER.phone);
    expect(screen.getByLabelText("Address")).toHaveValue(DEMO_CUSTOMER.addressLine1);
    expect(screen.getByLabelText("Town or city")).toHaveValue(DEMO_CUSTOMER.city);
    expect(screen.getByLabelText("Postcode")).toHaveValue(DEMO_CUSTOMER.postcode);
    expect(screen.getByLabelText("Country")).toHaveValue(DEMO_CUSTOMER.country);
    for (const input of screen.getAllByRole("textbox")) {
      expect(input).toHaveAttribute("readonly");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates demo-account selection without submitting or clearing the cart", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fill the fixed demo account before completing the order.",
    );
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("sends the exact canonical payload once and clears the cart after confirmation", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchSpy = vi.fn<typeof fetch>(() => pendingResponse);
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Redirecting to payment…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fill with demo account" })).toBeDisabled();
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");

    const [path, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(path).toBe("/api/orders");
    expect(requestInit).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = parseRequestBody(requestInit);
    expect(typeof payload.idempotencyKey).toBe("string");
    expect(payload.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(payload).toEqual({
      idempotencyKey: payload.idempotencyKey,
      demoCustomerId: DEMO_CUSTOMER.id,
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });

    resolveRequest?.(successfulResponse());

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        `/api/orders/${completedOrder.id}/payment/redirect`,
      );
    });
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("0");
  });

  it("prevents duplicate concurrent submissions", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.dblClick(screen.getByRole("button", { name: "Pay by card" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");
  });

  it("preserves the form and cart on failure and reuses the key for a retry", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The order service could not be reached. Try again.",
    );
    expect(screen.getByLabelText("Full name")).toHaveValue(DEMO_CUSTOMER.fullName);
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");

    await user.click(screen.getByRole("button", { name: "Pay by card" }));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstPayload = parseRequestBody(fetchSpy.mock.calls[0]?.[1]);
    const retryPayload = parseRequestBody(fetchSpy.mock.calls[1]?.[1]);
    expect(retryPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        `/api/orders/${completedOrder.id}/payment/redirect`,
      );
    });
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("0");
  });

  it("reuses a saved attempt after remount and shows its original summary", async () => {
    const firstRequest = new Promise<Response>(() => undefined);
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.click(screen.getByRole("button", { name: "Pay by card" }));
    const initialPayload = parseRequestBody(fetchSpy.mock.calls[0]?.[1]);

    await user.click(screen.getByRole("link", { name: "Leave checkout" }));
    await user.click(screen.getByRole("button", { name: "Add later cart item" }));
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("4");
    await user.click(screen.getByRole("link", { name: "Return to checkout" }));

    expect(
      screen.getByText(/saved order attempt being retried/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rs\s*186\.95/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    const retryPayload = parseRequestBody(fetchSpy.mock.calls[1]?.[1]);
    expect(retryPayload).toEqual(initialPayload);
    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        `/api/orders/${completedOrder.id}/payment/redirect`,
      );
    });
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("1");
  });

  it("does not let an unmounted completion erase later cart changes", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchSpy = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.click(screen.getByRole("button", { name: "Pay by card" }));
    await user.click(screen.getByRole("link", { name: "Leave checkout" }));
    await user.click(screen.getByRole("button", { name: "Add later cart item" }));
    await user.click(screen.getByRole("button", { name: "Change submitted quantity" }));

    resolveRequest?.(successfulResponse());

    expect(await screen.findByLabelText("Cart item count")).toHaveTextContent("4");
    await user.click(screen.getByRole("link", { name: "Return to checkout" }));
    expect(
      await screen.findByRole("heading", { name: "Demo order completed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CG-DEAD1234")).toBeInTheDocument();
  });

  it("rejects an invalid confirmation without clearing the cart", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ...completedOrder, status: "paid" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Fill with demo account" }));
    await user.click(screen.getByRole("button", { name: "Pay by card" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The order service returned an invalid confirmation.",
    );
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");
    expect(screen.queryByText("CG-DEAD1234")).not.toBeInTheDocument();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("contains no payment-entry controls or claim that the order is paid", () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    const { container } = renderCheckout();

    expect(container.querySelector('input[name*="card" i]')).toBeNull();
    expect(container.querySelector('input[autocomplete^="cc-"]')).toBeNull();
    expect(screen.queryByText(/^paid$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/redirected to JazzCash/i)).toBeInTheDocument();
  });

  it("redirects an empty fresh checkout to the cart page", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    renderCheckout([]);

    expect(await screen.findByText("Your cart route")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkout" })).not.toBeInTheDocument();
  });
});
