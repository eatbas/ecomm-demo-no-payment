import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOrder,
  listCompletedOrders,
  OrderApiError,
} from "@/features/orders/order.api";
import { createCompletedOrder, createJsonResponse } from "@/test/orders";

const validOrder = createCompletedOrder();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("order API client", () => {
  it("posts the strict order request to the same-origin endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(createJsonResponse(validOrder));
    vi.stubGlobal("fetch", fetchSpy);
    const request = {
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      demoCustomerId: "demo-customer" as const,
      lines: [{ productId: "everyday-backpack" as const, quantity: 1 }],
    };

    await expect(createOrder(request)).resolves.toEqual(validOrder);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });

  it("gets the bounded admin list", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(createJsonResponse({ orders: [validOrder] }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(listCompletedOrders()).resolves.toEqual({ orders: [validOrder] });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/orders?limit=50",
      expect.any(Object),
    );
  });

  it("rejects service and response failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse(
          { code: "INVALID_ORDER", message: "Order rejected." },
          400,
        ),
      ),
    );
    await expect(listCompletedOrders()).rejects.toThrow("Order rejected.");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse({ orders: [null] })),
    );
    await expect(listCompletedOrders()).rejects.toBeInstanceOf(OrderApiError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({ message: "Untrusted error without a code." }, 500),
      ),
    );
    await expect(listCompletedOrders()).rejects.toThrow(
      "The order service rejected the request.",
    );
  });
});
