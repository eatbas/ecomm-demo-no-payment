import { describe, expect, it } from "vitest";

import {
  MAX_ORDER_ERROR_MESSAGE_LENGTH,
  MAX_ORDER_PRODUCT_NAME_LENGTH,
  MAX_ORDER_UNIT_PRICE_CENTS,
} from "../../../shared/orders";
import {
  parseAdminOrdersResponse,
  parseOrder,
  parseOrderErrorResponse,
  parseOrderStatusResponse,
} from "@/features/orders/order.validation";
import {
  createOrderFixture,
  createOrderItemFixture,
} from "@/test/orders";

const validOrder = createOrderFixture();

describe("order response validation", () => {
  it("accepts a complete internally consistent order", () => {
    expect(parseOrder(validOrder)).toEqual(validOrder);
    expect(parseAdminOrdersResponse({ orders: [validOrder] })).toEqual({
      orders: [validOrder],
    });
  });

  it("rejects inconsistent or unexpected server data", () => {
    expect(parseOrder({ ...validOrder, subtotalCents: 1 })).toBeNull();
    expect(parseOrder({ ...validOrder, paid: true })).toBeNull();
    expect(parseOrder({ ...validOrder, paymentStatus: "unknown" })).toBeNull();
    expect(
      parseOrder({
        ...validOrder,
        customer: {
          ...validOrder.customer,
          email: "not-an-email",
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
          createOrderFixture({
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
    expect(parseOrder({ ...validOrder, ...override })).toBeNull();
  });

  it.each([
    [
      "duplicate snapshot identifiers",
      [createOrderItemFixture(), createOrderItemFixture()],
    ],
    [
      "empty snapshot identifier",
      [createOrderItemFixture({ productId: "" })],
    ],
    [
      "oversized product name",
      [
        createOrderItemFixture({
          productName: "x".repeat(MAX_ORDER_PRODUCT_NAME_LENGTH + 1),
        }),
      ],
    ],
    ["zero unit price", [createOrderItemFixture({ unitPriceCents: 0 })]],
    [
      "oversized unit price",
      [
        createOrderItemFixture({
          unitPriceCents: MAX_ORDER_UNIT_PRICE_CENTS + 1,
        }),
      ],
    ],
  ])("rejects %s", (_description, items) => {
    expect(parseOrder(createOrderFixture({ items }))).toBeNull();
  });

  it("accepts a bounded historical snapshot identifier", () => {
    const historicalOrder = createOrderFixture({
      items: [
        createOrderItemFixture({
          productId: "retired-product",
          productName: "Retired product",
        }),
      ],
    });

    expect(parseOrder(historicalOrder)).toEqual(historicalOrder);
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

  it("strictly parses an order status response", () => {
    const status = {
      id: validOrder.id,
      reference: validOrder.reference,
      paymentStatus: "awaiting_payment",
    };
    expect(parseOrderStatusResponse(status)).toEqual(status);
    expect(
      parseOrderStatusResponse({ ...status, paymentStatus: "unknown" }),
    ).toBeNull();
    expect(parseOrderStatusResponse({ ...status, extra: true })).toBeNull();
    expect(parseOrderStatusResponse(null)).toBeNull();
  });
});
