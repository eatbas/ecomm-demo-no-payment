import {
  DEMO_CUSTOMER,
  MAX_ADMIN_ORDER_LIMIT,
  MAX_ORDER_ERROR_MESSAGE_LENGTH,
  MAX_ORDER_LINES,
  MAX_ORDER_PRODUCT_NAME_LENGTH,
  MAX_ORDER_QUANTITY,
  MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH,
  MAX_ORDER_SUBTOTAL_CENTS,
  MAX_ORDER_UNIT_PRICE_CENTS,
  ORDER_CURRENCY,
  ORDER_ERROR_CODES,
  ORDER_ID_PATTERN,
  ORDER_REFERENCE_PATTERN,
  ORDER_SNAPSHOT_PRODUCT_ID_PATTERN,
  ORDER_STATUS,
  ORDER_TIMESTAMP_PATTERN,
  PAYMENT_STATUSES,
  type AdminOrdersResponse,
  type CompletedOrder,
  type CompletedOrderItem,
  type OrderErrorResponse,
  type PaymentStatus,
} from "../../../shared/orders";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !ORDER_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function parseOrderItem(value: unknown): CompletedOrderItem | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "productId",
      "productName",
      "unitPriceCents",
      "quantity",
      "lineTotalCents",
    ]) ||
    typeof value.productId !== "string" ||
    value.productId.length > MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH ||
    !ORDER_SNAPSHOT_PRODUCT_ID_PATTERN.test(value.productId) ||
    typeof value.productName !== "string" ||
    value.productName.length === 0 ||
    value.productName.length > MAX_ORDER_PRODUCT_NAME_LENGTH ||
    !isNonNegativeInteger(value.unitPriceCents) ||
    value.unitPriceCents < 1 ||
    value.unitPriceCents > MAX_ORDER_UNIT_PRICE_CENTS ||
    !isNonNegativeInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > MAX_ORDER_QUANTITY ||
    !isNonNegativeInteger(value.lineTotalCents) ||
    value.lineTotalCents < 1 ||
    value.lineTotalCents > MAX_ORDER_SUBTOTAL_CENTS ||
    value.lineTotalCents !== value.unitPriceCents * value.quantity
  ) {
    return null;
  }

  return {
    productId: value.productId,
    productName: value.productName,
    unitPriceCents: value.unitPriceCents,
    quantity: value.quantity,
    lineTotalCents: value.lineTotalCents,
  };
}

function hasExpectedDemoCustomer(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, Object.keys(DEMO_CUSTOMER)) &&
    Object.entries(DEMO_CUSTOMER).every(([key, expected]) => value[key] === expected)
  );
}

export function parseCompletedOrder(value: unknown): CompletedOrder | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "reference",
      "createdAt",
      "status",
      "paymentStatus",
      "currency",
      "subtotalCents",
      "itemCount",
      "demoCustomer",
      "items",
    ]) ||
    typeof value.id !== "string" ||
    !ORDER_ID_PATTERN.test(value.id) ||
    typeof value.reference !== "string" ||
    !ORDER_REFERENCE_PATTERN.test(value.reference) ||
    !isCanonicalTimestamp(value.createdAt) ||
    value.status !== ORDER_STATUS ||
    typeof value.paymentStatus !== "string" ||
    !PAYMENT_STATUSES.includes(value.paymentStatus as PaymentStatus) ||
    value.currency !== ORDER_CURRENCY ||
    !isNonNegativeInteger(value.subtotalCents) ||
    value.subtotalCents < 1 ||
    value.subtotalCents > MAX_ORDER_SUBTOTAL_CENTS ||
    !isNonNegativeInteger(value.itemCount) ||
    value.itemCount < 1 ||
    value.itemCount > MAX_ORDER_LINES * MAX_ORDER_QUANTITY ||
    !hasExpectedDemoCustomer(value.demoCustomer) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > MAX_ORDER_LINES
  ) {
    return null;
  }

  const items = value.items.map(parseOrderItem);
  if (items.some((item) => item === null)) {
    return null;
  }

  const validItems = items as CompletedOrderItem[];
  if (
    new Set(validItems.map((item) => item.productId)).size !== validItems.length
  ) {
    return null;
  }

  const subtotalCents = validItems.reduce(
    (total, item) => total + item.lineTotalCents,
    0,
  );
  const itemCount = validItems.reduce((total, item) => total + item.quantity, 0);
  if (subtotalCents !== value.subtotalCents || itemCount !== value.itemCount) {
    return null;
  }

  return {
    id: value.id,
    reference: value.reference,
    createdAt: value.createdAt,
    status: ORDER_STATUS,
    paymentStatus: value.paymentStatus as PaymentStatus,
    currency: ORDER_CURRENCY,
    subtotalCents: value.subtotalCents,
    itemCount: value.itemCount,
    demoCustomer: DEMO_CUSTOMER,
    items: validItems,
  };
}

export interface OrderStatusResponse {
  readonly id: string;
  readonly reference: string;
  readonly paymentStatus: PaymentStatus;
}

export function parseOrderStatusResponse(value: unknown): OrderStatusResponse | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["id", "reference", "paymentStatus"]) ||
    typeof value.id !== "string" ||
    !ORDER_ID_PATTERN.test(value.id) ||
    typeof value.reference !== "string" ||
    !ORDER_REFERENCE_PATTERN.test(value.reference) ||
    typeof value.paymentStatus !== "string" ||
    !PAYMENT_STATUSES.includes(value.paymentStatus as PaymentStatus)
  ) {
    return null;
  }

  return {
    id: value.id,
    reference: value.reference,
    paymentStatus: value.paymentStatus as PaymentStatus,
  };
}

export function parseOrderErrorResponse(value: unknown): OrderErrorResponse | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["code", "message"]) ||
    typeof value.code !== "string" ||
    !ORDER_ERROR_CODES.some((code) => code === value.code) ||
    typeof value.message !== "string" ||
    value.message.trim().length === 0 ||
    value.message.length > MAX_ORDER_ERROR_MESSAGE_LENGTH
  ) {
    return null;
  }

  return {
    code: value.code as OrderErrorResponse["code"],
    message: value.message,
  };
}

export function parseAdminOrdersResponse(value: unknown): AdminOrdersResponse | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["orders"]) ||
    !Array.isArray(value.orders) ||
    value.orders.length > MAX_ADMIN_ORDER_LIMIT
  ) {
    return null;
  }

  const orders = value.orders.map(parseCompletedOrder);
  if (orders.some((order) => order === null)) {
    return null;
  }

  const validOrders = orders as CompletedOrder[];
  const orderIds = new Set(validOrders.map((order) => order.id));
  const references = new Set(validOrders.map((order) => order.reference));
  const isNewestFirst = validOrders.every(
    (order, index) =>
      index === 0 ||
      Date.parse(validOrders[index - 1]?.createdAt ?? "") >=
        Date.parse(order.createdAt),
  );
  return orderIds.size === validOrders.length &&
    references.size === validOrders.length &&
    isNewestFirst
    ? { orders: validOrders }
    : null;
}
