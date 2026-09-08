import {
  ORDER_CURRENCY,
  type CustomerDetails,
  type Order,
  type OrderItem,
} from "../../shared/orders";

export const TEST_CUSTOMER: CustomerDetails = Object.freeze({
  fullName: "Zara Khan",
  email: "zara@example.test",
  phone: "+92 300 1234567",
  addressLine1: "12 Model Town",
  city: "Lahore",
  postcode: "54700",
  country: "Pakistan",
});

type OrderItemOverrides = Partial<OrderItem>;

interface OrderOverrides
  extends Partial<Omit<Order, "itemCount" | "items" | "subtotalCents">> {
  readonly itemCount?: number;
  readonly items?: readonly OrderItem[];
  readonly subtotalCents?: number;
}

export function createOrderItemFixture(
  overrides: OrderItemOverrides = {},
): OrderItem {
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

export function createOrderFixture(overrides: OrderOverrides = {}): Order {
  const items = overrides.items ?? [createOrderItemFixture()];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalCents = items.reduce(
    (total, item) => total + item.lineTotalCents,
    0,
  );

  return {
    id: "ord_123e4567-e89b-42d3-a456-426614174000",
    reference: "CG-AB12CD34",
    createdAt: "2026-08-25T12:00:00.000Z",
    paymentStatus: "paid",
    currency: ORDER_CURRENCY,
    customer: TEST_CUSTOMER,
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
