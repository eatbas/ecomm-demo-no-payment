import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AdminPage } from "@/pages/AdminPage";
import {
  createCompletedOrder,
  createCompletedOrderItem,
  createJsonResponse,
} from "@/test/orders";

const completedOrder = createCompletedOrder({
  reference: "CG-ABC12345",
  createdAt: "2026-08-25T12:34:56.000Z",
  items: [
    createCompletedOrderItem({ quantity: 2 }),
  ],
});

function renderAdminPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPage", () => {
  it("loads the bounded public endpoint and shows the empty state without authentication UI", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(createJsonResponse({ orders: [] }));
    vi.stubGlobal("fetch", fetchSpy);

    renderAdminPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading completed orders",
    );
    expect(
      await screen.findByRole("heading", { name: "No completed orders" }),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [requestPath, requestInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(requestPath).toBe("/api/admin/orders?limit=50");
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
    expect(screen.queryByLabelText(/password|credential/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in|log in/i })).toBeNull();
  });

  it("renders completed order details as text in semantic desktop and mobile views", async () => {
    const maliciousName = '<img src="x" onerror="alert(1)">';
    const orderWithUntrustedText = createCompletedOrder({
      reference: completedOrder.reference,
      createdAt: completedOrder.createdAt,
      items: [
        createCompletedOrderItem({ productName: maliciousName, quantity: 2 }),
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ orders: [orderWithUntrustedText] })),
    );

    const { container } = renderAdminPage();

    const table = await screen.findByRole("table", {
      name: "Completed demo orders",
    });
    expect(within(table).getByRole("columnheader", { name: "Order" })).toBeVisible();
    expect(within(table).getByText("CG-ABC12345")).toBeInTheDocument();
    expect(within(table).getByText("Alex Example")).toBeInTheDocument();
    expect(within(table).getByText(/^Rs\s*158\.00$/)).toBeInTheDocument();
    expect(screen.getAllByText("Completed")).not.toHaveLength(0);
    expect(screen.getAllByText("Awaiting payment")).not.toHaveLength(0);
    expect(screen.getAllByText(maliciousName)).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();

    const mobileList = screen.getByRole("list", {
      name: "Completed demo orders",
    });
    expect(
      within(mobileList).getByRole("heading", {
        level: 2,
        name: "CG-ABC12345",
      }),
    ).toBeInTheDocument();
    expect(
      within(mobileList).getByRole("heading", {
        level: 3,
        name: "Synthetic demo account",
      }),
    ).toBeInTheDocument();
    expect(within(mobileList).getByText(completedOrder.demoCustomer.phone)).toBeInTheDocument();
    expect(within(mobileList).getByText("Server total")).toBeInTheDocument();
  });

  it("shows a useful error and retries the read-only request", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            code: "INTERNAL_ERROR",
            message: "The demo order service is temporarily unavailable.",
          },
          503,
        ),
      )
      .mockResolvedValueOnce(createJsonResponse({ orders: [] }));
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    renderAdminPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The demo order service is temporarily unavailable.",
    );
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "No completed orders" }),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("/api/admin/orders?limit=50");
  });

  it("rejects an invalid response without rendering its values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          orders: [{ ...completedOrder, paymentStatus: "invalid_status" }],
        }),
      ),
    );

    renderAdminPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invalid order list",
    );
    expect(screen.queryByText("CG-ABC12345")).toBeNull();
    expect(screen.queryByText("invalid_status")).toBeNull();
  });

  it("aborts loading on unmount", () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { unmount } = renderAdminPage();

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.signal?.aborted).toBe(false);

    unmount();

    expect(requestInit?.signal?.aborted).toBe(true);
    resolveRequest?.(createJsonResponse({ orders: [] }));
  });
});
