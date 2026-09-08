import {
  isValidCustomerDetails,
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
  ORDER_TIMESTAMP_PATTERN,
  PAYMENT_STATUSES,
  type AdminOrdersResponse,
  type Order,
  type OrderErrorResponse,
  type OrderItem,
  type PaymentStatus,
} from "../../../shared/orders";

export interface OrderStatusResponse {
  readonly id: string;
  readonly reference: string;
  readonly paymentStatus: PaymentStatus;
}

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

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !ORDER_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function parseOrderItem(value: unknown): OrderItem | null {
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

export function parseOrder(value: unknown): Order | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "reference",
      "createdAt",
      "paymentStatus",
      "currency",
      "subtotalCents",
      "itemCount",
      "customer",
      "items",
    ]) ||
    typeof value.id !== "string" ||
    !ORDER_ID_PATTERN.test(value.id) ||
    typeof value.reference !== "string" ||
    !ORDER_REFERENCE_PATTERN.test(value.reference) ||
    !isCanonicalTimestamp(value.createdAt) ||
    !isPaymentStatus(value.paymentStatus) ||
    value.currency !== ORDER_CURRENCY ||
    !isNonNegativeInteger(value.subtotalCents) ||
    value.subtotalCents < 1 ||
    value.subtotalCents > MAX_ORDER_SUBTOTAL_CENTS ||
    !isNonNegativeInteger(value.itemCount) ||
    value.itemCount < 1 ||
    value.itemCount > MAX_ORDER_LINES * MAX_ORDER_QUANTITY ||
    !isValidCustomerDetails(value.customer) ||
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

  const validItems = items as OrderItem[];
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
    paymentStatus: value.paymentStatus,
    currency: ORDER_CURRENCY,
    subtotalCents: value.subtotalCents,
    itemCount: value.itemCount,
    customer: value.customer,
    items: validItems,
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

  const orders = value.orders.map(parseOrder);
  if (orders.some((order) => order === null)) {
    return null;
  }

  const validOrders = orders as Order[];
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

export function parseOrderStatusResponse(value: unknown): OrderStatusResponse | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["id", "reference", "paymentStatus"]) ||
    typeof value.id !== "string" ||
    !ORDER_ID_PATTERN.test(value.id) ||
    typeof value.reference !== "string" ||
    !ORDER_REFERENCE_PATTERN.test(value.reference) ||
    !isPaymentStatus(value.paymentStatus)
  ) {
    return null;
  }

  return {
    id: value.id,
    reference: value.reference,
    paymentStatus: value.paymentStatus,
  };
}
