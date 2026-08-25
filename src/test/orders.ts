import {
  DEMO_CUSTOMER,
  ORDER_CURRENCY,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  type CompletedOrder,
  type CompletedOrderItem,
} from "../../shared/orders";

type CompletedOrderItemOverrides = Partial<CompletedOrderItem>;

interface CompletedOrderOverrides
  extends Partial<Omit<CompletedOrder, "itemCount" | "items" | "subtotalCents">> {
  readonly itemCount?: number;
  readonly items?: readonly CompletedOrderItem[];
  readonly subtotalCents?: number;
}

export function createCompletedOrderItem(
  overrides: CompletedOrderItemOverrides = {},
): CompletedOrderItem {
  const unitPriceCents = overrides.unitPriceCents ?? 7_900;
  const quantity = overrides.quantity ?? 1;

  return {
    productId: "everyday-backpack",
    productName: "Everyday backpack",
    ...overrides,
    unitPriceCents,
    quantity,
    lineTotalCents: overrides.lineTotalCents ?? unitPriceCents * quantity,
  };
}

export function createCompletedOrder(
  overrides: CompletedOrderOverrides = {},
): CompletedOrder {
  const items = overrides.items ?? [createCompletedOrderItem()];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalCents = items.reduce(
    (total, item) => total + item.lineTotalCents,
    0,
  );

  return {
    id: "ord_123e4567-e89b-42d3-a456-426614174000",
    reference: "CG-AB12CD34",
    createdAt: "2026-08-25T12:00:00.000Z",
    status: ORDER_STATUS,
    paymentStatus: ORDER_PAYMENT_STATUS,
    currency: ORDER_CURRENCY,
    demoCustomer: DEMO_CUSTOMER,
    ...overrides,
    items,
    itemCount: overrides.itemCount ?? itemCount,
    subtotalCents: overrides.subtotalCents ?? subtotalCents,
  };
}

export function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
