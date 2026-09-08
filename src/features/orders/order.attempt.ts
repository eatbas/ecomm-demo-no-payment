import { isProductId } from "../../../shared/catalogue";
import {
  isValidCustomerDetails,
  MAX_ORDER_LINES,
  MAX_ORDER_QUANTITY,
  type CreateOrderLine,
  type CustomerDetails,
} from "../../../shared/orders";

const ORDER_ATTEMPT_STORAGE_KEY = "ecomm-demo:order-attempt:v2";
const VERSION_FOUR_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface SessionStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface OrderAttempt {
  readonly idempotencyKey: string;
  readonly customer: CustomerDetails;
  readonly lines: readonly CreateOrderLine[];
}

function getSessionStorage(): SessionStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function parseAttemptLine(value: unknown): CreateOrderLine | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !("productId" in value) ||
    !("quantity" in value) ||
    !isProductId(value.productId) ||
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > MAX_ORDER_QUANTITY
  ) {
    return null;
  }

  return { productId: value.productId, quantity: value.quantity };
}

function parseOrderAttempt(value: unknown): OrderAttempt | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 3 ||
    !("idempotencyKey" in value) ||
    !("customer" in value) ||
    !("lines" in value) ||
    typeof value.idempotencyKey !== "string" ||
    !VERSION_FOUR_UUID_PATTERN.test(value.idempotencyKey) ||
    !isValidCustomerDetails(value.customer) ||
    !Array.isArray(value.lines) ||
    value.lines.length < 1 ||
    value.lines.length > MAX_ORDER_LINES
  ) {
    return null;
  }

  const lines = value.lines.map(parseAttemptLine);
  if (lines.some((line) => line === null)) {
    return null;
  }

  const parsedLines = lines as CreateOrderLine[];
  if (new Set(parsedLines.map((line) => line.productId)).size !== parsedLines.length) {
    return null;
  }

  return {
    idempotencyKey: value.idempotencyKey,
    customer: value.customer,
    lines: parsedLines,
  };
}

export function loadOrderAttempt(
  storage = getSessionStorage(),
): OrderAttempt | null {
  if (storage === undefined) {
    return null;
  }

  try {
    const serialisedAttempt = storage.getItem(ORDER_ATTEMPT_STORAGE_KEY);
    return serialisedAttempt === null
      ? null
      : parseOrderAttempt(JSON.parse(serialisedAttempt) as unknown);
  } catch {
    return null;
  }
}

export function saveOrderAttempt(
  attempt: OrderAttempt,
  storage = getSessionStorage(),
): void {
  try {
    storage?.setItem(ORDER_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // The live attempt remains usable when browser storage is unavailable.
  }
}

export function clearOrderAttempt(
  idempotencyKey: string,
  storage = getSessionStorage(),
): boolean {
  if (storage === undefined) {
    return false;
  }

  try {
    if (loadOrderAttempt(storage)?.idempotencyKey === idempotencyKey) {
      storage.removeItem(ORDER_ATTEMPT_STORAGE_KEY);
      return true;
    }
  } catch {
    // A failed clean-up must not turn a completed request into an error.
  }

  return false;
}
