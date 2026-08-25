import { describe, expect, it } from "vitest";

import {
  MAX_ORDER_ERROR_MESSAGE_LENGTH,
  MAX_ORDER_PRODUCT_NAME_LENGTH,
  MAX_ORDER_UNIT_PRICE_CENTS,
} from "../../../shared/orders";
import {
  parseAdminOrdersResponse,
  parseCompletedOrder,
  parseOrderErrorResponse,
} from "@/features/orders/order.validation";
import {
  createCompletedOrder,
  createCompletedOrderItem,
} from "@/test/orders";

const validOrder = createCompletedOrder();

describe("order response validation", () => {
  it("accepts a complete internally consistent order", () => {
    expect(parseCompletedOrder(validOrder)).toEqual(validOrder);
    expect(parseAdminOrdersResponse({ orders: [validOrder] })).toEqual({
      orders: [validOrder],
    });
  });

  it("rejects inconsistent or unexpected server data", () => {
    expect(
      parseCompletedOrder({ ...validOrder, subtotalCents: 1 }),
    ).toBeNull();
    expect(parseCompletedOrder({ ...validOrder, paid: true })).toBeNull();
    expect(
      parseCompletedOrder({
        ...validOrder,
        demoCustomer: {
          ...validOrder.demoCustomer,
          email: "someone@example.test",
        },
      }),
    ).toBeNull();
  });

  it("rejects malformed admin responses", () => {
    expect(parseAdminOrdersResponse({ orders: [null] })).toBeNull();
    expect(parseAdminOrdersResponse({ orders: [], extra: true })).toBeNull();
    expect(
      parseAdminOrdersResponse({ orders: [validOrder, validOrder] }),
    ).toBeNull();
    expect(
      parseAdminOrdersResponse({
        orders: [
          createCompletedOrder({
            id: "ord_123e4567-e89b-42d3-a456-426614174001",
            reference: "CG-AB12CD35",
            createdAt: "2026-08-24T12:00:00.000Z",
          }),
          validOrder,
        ],
      }),
    ).toBeNull();
  });

  it.each([
    ["malformed order ID", { id: "ord_------------------------------------" }],
    ["non-ISO timestamp", { createdAt: "0" }],
    ["impossible calendar date", { createdAt: "2026-02-31T12:00:00.000Z" }],
    ["zero subtotal", { subtotalCents: 0 }],
    ["oversized subtotal", { subtotalCents: Number.MAX_SAFE_INTEGER }],
  ])("rejects %s", (_description, override) => {
    expect(parseCompletedOrder({ ...validOrder, ...override })).toBeNull();
  });

  it.each([
    [
      "duplicate snapshot identifiers",
      [createCompletedOrderItem(), createCompletedOrderItem()],
    ],
    [
      "empty snapshot identifier",
      [createCompletedOrderItem({ productId: "" })],
    ],
    [
      "oversized product name",
      [
        createCompletedOrderItem({
          productName: "x".repeat(MAX_ORDER_PRODUCT_NAME_LENGTH + 1),
        }),
      ],
    ],
    ["zero unit price", [createCompletedOrderItem({ unitPriceCents: 0 })]],
    [
      "oversized unit price",
      [
        createCompletedOrderItem({
          unitPriceCents: MAX_ORDER_UNIT_PRICE_CENTS + 1,
        }),
      ],
    ],
  ])("rejects %s", (_description, items) => {
    expect(parseCompletedOrder(createCompletedOrder({ items }))).toBeNull();
  });

  it("accepts a bounded historical snapshot identifier", () => {
    const historicalOrder = createCompletedOrder({
      items: [
        createCompletedOrderItem({
          productId: "retired-product",
          productName: "Retired product",
        }),
      ],
    });

    expect(parseCompletedOrder(historicalOrder)).toEqual(historicalOrder);
  });

  it("strictly parses bounded order errors", () => {
    expect(
      parseOrderErrorResponse({
        code: "INVALID_ORDER",
        message: "The order is invalid.",
      }),
    ).toEqual({ code: "INVALID_ORDER", message: "The order is invalid." });
    expect(
      parseOrderErrorResponse({ code: "UNKNOWN", message: "Not allowed." }),
    ).toBeNull();
    expect(
      parseOrderErrorResponse({
        code: "INVALID_ORDER",
        message: "x".repeat(MAX_ORDER_ERROR_MESSAGE_LENGTH + 1),
      }),
    ).toBeNull();
    expect(
      parseOrderErrorResponse({
        code: "INVALID_ORDER",
        message: "The order is invalid.",
        extra: true,
      }),
    ).toBeNull();
  });
});
