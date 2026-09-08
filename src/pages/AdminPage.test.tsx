import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AdminPage } from "@/pages/AdminPage";
import {
  createJsonResponse,
  createOrderFixture,
} from "@/test/orders";

const paidOrder = createOrderFixture({
  reference: "CG-ABC12345",
  createdAt: "2026-08-25T12:34:56.000Z",
  paymentStatus: "paid",
  items: [
    {
      productId: "everyday-backpack",
      productName: "Everyday backpack",
      unitPriceCents: 7_900,
      quantity: 2,
      lineTotalCents: 15_800,
    },
  ],
});

function renderAdminPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

function routeAwareFetch(
  handlers: Partial<Record<string, () => Response>>,
): ReturnType<typeof vi.fn> {
  return vi.fn((input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const key = Object.keys(handlers).find((path) => url.startsWith(path));
    if (key === undefined) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return Promise.resolve(handlers[key]!());
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPage", () => {
  it("shows the sign-in form when no admin session exists", async () => {
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 401 }),
      }),
    );

    renderAdminPage();

    expect(
      await screen.findByRole("heading", { name: "Admin sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Orders" })).not.toBeInTheDocument();
  });

  it("signs in, loads the empty state, and shows no orders", async () => {
    const fetchSpy = routeAwareFetch({
      "/api/admin/session": () => new Response(null, { status: 401 }),
      "/api/admin/login": () => new Response(null, { status: 204 }),
      "/api/admin/orders": () => createJsonResponse({ orders: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    renderAdminPage();

    await user.type(await screen.findByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "No completed orders" }),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error and stays on the sign-in form for a wrong password", async () => {
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 401 }),
        "/api/admin/login": () => new Response(null, { status: 401 }),
      }),
    );
    const user = userEvent.setup();
    renderAdminPage();

    await user.type(await screen.findByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect admin password.",
    );
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
  });

  it("renders paid order details, including real payment status, once signed in", async () => {
    const maliciousName = '<img src="x" onerror="alert(1)">';
    const orderWithUntrustedText = createOrderFixture({
      reference: paidOrder.reference,
      createdAt: paidOrder.createdAt,
      paymentStatus: "paid",
      items: [
        {
          productId: "everyday-backpack",
          productName: maliciousName,
          unitPriceCents: 7_900,
          quantity: 2,
          lineTotalCents: 15_800,
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 204 }),
        "/api/admin/orders": () =>
          createJsonResponse({ orders: [orderWithUntrustedText] }),
      }),
    );

    const { container } = renderAdminPage();

    const table = await screen.findByRole("table", {
      name: "Completed demo orders",
    });
    expect(within(table).getByRole("columnheader", { name: "Order" })).toBeVisible();
    expect(within(table).getByText("CG-ABC12345")).toBeInTheDocument();
    expect(within(table).getByText(paidOrder.customer.fullName)).toBeInTheDocument();
    expect(within(table).getByText("Rs 158.00")).toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText(maliciousName)).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();

    const mobileList = screen.getByRole("list", {
      name: "Completed demo orders",
    });
    expect(
      within(mobileList).getByRole("heading", { level: 2, name: "CG-ABC12345" }),
    ).toBeInTheDocument();
    expect(
      within(mobileList).getByRole("heading", { level: 3, name: "Customer" }),
    ).toBeInTheDocument();
    expect(
      within(mobileList).getByText(paidOrder.customer.phone),
    ).toBeInTheDocument();
    expect(within(mobileList).getByText("Server total")).toBeInTheDocument();
  });

  it("shows a useful error and retries the read-only request", async () => {
    let orderCallCount = 0;
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 204 }),
        "/api/admin/orders": () => {
          orderCallCount += 1;
          return orderCallCount === 1
            ? createJsonResponse(
                {
                  code: "INTERNAL_ERROR",
                  message: "The order service is temporarily unavailable.",
                },
                503,
              )
            : createJsonResponse({ orders: [] });
        },
      }),
    );
    const user = userEvent.setup();
    renderAdminPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The order service is temporarily unavailable.");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "No completed orders" }),
    ).toBeInTheDocument();
    expect(orderCallCount).toBe(2);
  });

  it("rejects an invalid response without rendering its values", async () => {
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 204 }),
        "/api/admin/orders": () =>
          createJsonResponse({
            orders: [{ ...paidOrder, paymentStatus: "not-a-real-status" }],
          }),
      }),
    );

    renderAdminPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid order list");
    expect(screen.queryByText("CG-ABC12345")).toBeNull();
  });

  it("signs out and returns to the sign-in form", async () => {
    vi.stubGlobal(
      "fetch",
      routeAwareFetch({
        "/api/admin/session": () => new Response(null, { status: 204 }),
        "/api/admin/orders": () => createJsonResponse({ orders: [] }),
        "/api/admin/logout": () => new Response(null, { status: 204 }),
      }),
    );
    const user = userEvent.setup();
    renderAdminPage();

    await screen.findByRole("heading", { name: "Orders" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("heading", { name: "Admin sign in" }),
    ).toBeInTheDocument();
  });
});
