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
  ORDER_ERROR_CODES,
  ORDER_ID_PATTERN,
  ORDER_REFERENCE_PATTERN,
  ORDER_SNAPSHOT_PRODUCT_ID_PATTERN,
  ORDER_TIMESTAMP_PATTERN,
  type AdminOrdersResponse,
  type CompletedOrder,
  type CompletedOrderItem,
  type OrderCurrency,
  type OrderErrorResponse,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderTransactionDetails,
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

function parseOrderTransaction(value: unknown): OrderTransactionDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const allowedTransactionKeys = [
    "txnRefNo",
    "txnType",
    "amountPaisa",
    "currency",
    "status",
    "responseCode",
    "responseMessage",
    "retrievalRefNo",
    "authCode",
    "txnDatetime",
  ];

  if (!Object.keys(value).every((k) => allowedTransactionKeys.includes(k))) {
    return null;
  }

  if (
    typeof value.txnRefNo !== "string" ||
    value.txnRefNo.length === 0 ||
    typeof value.txnType !== "string" ||
    value.txnType.length === 0 ||
    !isNonNegativeInteger(value.amountPaisa) ||
    value.currency !== "PKR" ||
    !["initiated", "pending", "paid", "failed"].includes(value.status as string)
  ) {
    return null;
  }

  if (value.responseCode !== undefined && typeof value.responseCode !== "string") {
    return null;
  }
  if (value.responseMessage !== undefined && typeof value.responseMessage !== "string") {
    return null;
  }
  if (value.retrievalRefNo !== undefined && typeof value.retrievalRefNo !== "string") {
    return null;
  }
  if (value.authCode !== undefined && typeof value.authCode !== "string") {
    return null;
  }
  if (value.txnDatetime !== undefined && typeof value.txnDatetime !== "string") {
    return null;
  }

  return {
    txnRefNo: value.txnRefNo,
    txnType: value.txnType,
    amountPaisa: value.amountPaisa,
    currency: "PKR",
    status: value.status as OrderTransactionDetails["status"],
    responseCode: value.responseCode,
    responseMessage: value.responseMessage,
    retrievalRefNo: value.retrievalRefNo,
    authCode: value.authCode,
    txnDatetime: value.txnDatetime,
  };
}

const REQUIRED_ORDER_KEYS = [
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
] as const;

const OPTIONAL_ORDER_KEYS = ["transaction", "paymentRedirectUrl"] as const;

const VALID_ORDER_STATUSES: readonly string[] = ["pending", "completed", "failed"];
const VALID_PAYMENT_STATUSES: readonly string[] = [
  "pending",
  "paid",
  "failed",
  "not_configured",
];
const VALID_CURRENCIES: readonly string[] = ["EUR", "PKR"];

export function parseCompletedOrder(value: unknown): CompletedOrder | null {
  if (!isRecord(value)) {
    return null;
  }

  const actualKeys = Object.keys(value);
  const hasAllRequired = REQUIRED_ORDER_KEYS.every((key) =>
    actualKeys.includes(key),
  );
  const hasNoExtraneous = actualKeys.every(
    (key) =>
      REQUIRED_ORDER_KEYS.includes(key as (typeof REQUIRED_ORDER_KEYS)[number]) ||
      OPTIONAL_ORDER_KEYS.includes(key as (typeof OPTIONAL_ORDER_KEYS)[number]),
  );

  if (
    !hasAllRequired ||
    !hasNoExtraneous ||
    typeof value.id !== "string" ||
    !ORDER_ID_PATTERN.test(value.id) ||
    typeof value.reference !== "string" ||
    !ORDER_REFERENCE_PATTERN.test(value.reference) ||
    !isCanonicalTimestamp(value.createdAt) ||
    !VALID_ORDER_STATUSES.includes(value.status as string) ||
    !VALID_PAYMENT_STATUSES.includes(value.paymentStatus as string) ||
    !VALID_CURRENCIES.includes(value.currency as string) ||
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

  let transaction: OrderTransactionDetails | undefined;
  if (value.transaction !== undefined) {
    const parsedTxn = parseOrderTransaction(value.transaction);
    if (parsedTxn === null) {
      return null;
    }
    transaction = parsedTxn;
  }

  let paymentRedirectUrl: string | undefined;
  if (value.paymentRedirectUrl !== undefined) {
    if (
      typeof value.paymentRedirectUrl !== "string" ||
      !value.paymentRedirectUrl.startsWith("/api/payments/")
    ) {
      return null;
    }
    paymentRedirectUrl = value.paymentRedirectUrl;
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
    status: value.status as OrderStatus,
    paymentStatus: value.paymentStatus as OrderPaymentStatus,
    currency: value.currency as OrderCurrency,
    subtotalCents: value.subtotalCents,
    itemCount: value.itemCount,
    demoCustomer: DEMO_CUSTOMER,
    items: validItems,
    ...(transaction !== undefined ? { transaction } : {}),
    ...(paymentRedirectUrl !== undefined ? { paymentRedirectUrl } : {}),
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
