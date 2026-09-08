import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router";

import { CartProvider, useCart } from "@/features/cart/CartContext";
import { navigateTo } from "@/lib/navigation";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { seedStoredCart } from "@/test/cart";
import { createJsonResponse, createOrderFixture, TEST_CUSTOMER } from "@/test/orders";

vi.mock("@/lib/navigation", () => ({ navigateTo: vi.fn() }));

const completedOrder = createOrderFixture({
  reference: "CG-DEAD1234",
  createdAt: "2026-08-25T10:00:00.000Z",
  paymentStatus: "awaiting_payment",
  items: [
    { productId: "everyday-backpack", productName: "Everyday backpack", unitPriceCents: 7_900, quantity: 2, lineTotalCents: 15_800 },
    { productId: "travel-mug", productName: "Insulated travel mug", unitPriceCents: 2_895, quantity: 1, lineTotalCents: 2_895 },
  ],
});

function CartItemCount() {
  const { itemCount } = useCart();

  return <output aria-label="Cart item count">{itemCount}</output>;
}

function CartMutationRoute() {
  const { addItem } = useCart();

  return (
    <div>
      <p>Your cart route</p>
      <button type="button" onClick={() => addItem("desk-lamp")}>
        Add later cart item
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

async function fillCustomerDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), TEST_CUSTOMER.fullName);
  await user.type(screen.getByLabelText("Email address"), TEST_CUSTOMER.email);
  await user.type(screen.getByLabelText("Phone number"), TEST_CUSTOMER.phone);
  await user.type(screen.getByLabelText("Address"), TEST_CUSTOMER.addressLine1);
  await user.type(screen.getByLabelText("Town or city"), TEST_CUSTOMER.city);
  await user.type(screen.getByLabelText("Postcode"), TEST_CUSTOMER.postcode);
  await user.type(screen.getByLabelText("Country"), TEST_CUSTOMER.country);
}

function successfulResponse(order = completedOrder): Response {
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(navigateTo).mockClear();
});

describe("CheckoutPage", () => {
  it("renders empty, editable customer fields with no demo-fill affordance", () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    renderCheckout();

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delivery and billing details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payment" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Email address")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Fill with demo account" }),
    ).not.toBeInTheDocument();
  });

  it("blocks submission with an alert when details are incomplete", () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    const { container } = renderCheckout();

    // Bypasses the browser's native `required` gating to exercise this
    // component's own guard directly.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fill in every delivery and billing detail before continuing.",
    );
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");
  });

  it("creates the order then navigates to the JazzCash redirect page, clearing the cart", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await fillCustomerDetails(user);
    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(path).toBe("/api/orders");
    const payload = parseRequestBody(requestInit);
    expect(payload.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(payload).toEqual({
      idempotencyKey: payload.idempotencyKey,
      customer: TEST_CUSTOMER,
      lines: [
        { productId: "everyday-backpack", quantity: 2 },
        { productId: "travel-mug", quantity: 1 },
      ],
    });

    expect(await screen.findByLabelText("Cart item count")).toHaveTextContent("0");
    expect(navigateTo).toHaveBeenCalledWith(
      `/api/orders/${completedOrder.id}/payment/redirect`,
    );
  });

  it("prevents duplicate concurrent submissions", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await fillCustomerDetails(user);
    await user.dblClick(screen.getByRole("button", { name: "Continue to JazzCash" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");
  });

  it("preserves the form and cart on failure and reuses the idempotency key for a retry", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderCheckout();

    await fillCustomerDetails(user);
    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The order service could not be reached. Try again.",
    );
    expect(screen.getByLabelText("Full name")).toHaveValue(TEST_CUSTOMER.fullName);
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("3");

    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstPayload = parseRequestBody(fetchSpy.mock.calls[0]?.[1]);
    const retryPayload = parseRequestBody(fetchSpy.mock.calls[1]?.[1]);
    expect(retryPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(await screen.findByLabelText("Cart item count")).toHaveTextContent("0");
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

    await fillCustomerDetails(user);
    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));
    const initialPayload = parseRequestBody(fetchSpy.mock.calls[0]?.[1]);

    await user.click(screen.getByRole("link", { name: "Leave checkout" }));
    await user.click(screen.getByRole("button", { name: "Add later cart item" }));
    expect(screen.getByLabelText("Cart item count")).toHaveTextContent("4");
    await user.click(screen.getByRole("link", { name: "Return to checkout" }));

    expect(
      screen.getByText(/saved order attempt being retried/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Rs 186.95")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue(TEST_CUSTOMER.fullName);
    await user.click(screen.getByRole("button", { name: "Continue to JazzCash" }));

    const retryPayload = parseRequestBody(fetchSpy.mock.calls[1]?.[1]);
    expect(retryPayload).toEqual(initialPayload);
    expect(await screen.findByLabelText("Cart item count")).toHaveTextContent("1");
  });

  it("contains no local card-entry controls and explains the JazzCash hand-off", () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    const { container } = renderCheckout();

    expect(container.querySelector('input[name*="card" i]')).toBeNull();
    expect(container.querySelector('input[autocomplete^="cc-"]')).toBeNull();
    expect(
      screen.getByText(/never sees or stores your card number/i),
    ).toBeInTheDocument();
  });

  it("redirects an empty fresh checkout to the cart page", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    renderCheckout([]);

    expect(await screen.findByText("Your cart route")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkout" })).not.toBeInTheDocument();
  });
});
