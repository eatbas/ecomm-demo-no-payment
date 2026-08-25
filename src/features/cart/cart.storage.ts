import { isProductId } from "@/data/products";
import {
  EMPTY_CART,
  MAX_CART_QUANTITY,
  type CartLine,
  type CartState,
} from "@/features/cart/cart.types";

export const CART_STORAGE_KEY = "ecomm-demo:cart";
export const CART_STORAGE_VERSION = 1;

interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedCart {
  readonly version: typeof CART_STORAGE_VERSION;
  readonly lines: readonly CartLine[];
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

function parseLine(value: unknown): CartLine | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["productId", "quantity"]) ||
    !isProductId(value.productId) ||
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > MAX_CART_QUANTITY
  ) {
    return null;
  }

  return { productId: value.productId, quantity: value.quantity };
}

export function parseStoredCart(serialisedCart: string | null): CartState {
  if (serialisedCart === null) {
    return EMPTY_CART;
  }

  try {
    const value: unknown = JSON.parse(serialisedCart);

    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, ["version", "lines"]) ||
      value.version !== CART_STORAGE_VERSION ||
      !Array.isArray(value.lines)
    ) {
      return EMPTY_CART;
    }

    const parsedLines: CartLine[] = [];
    const productIds = new Set<string>();

    for (const line of value.lines) {
      const parsedLine = parseLine(line);

      if (parsedLine === null || productIds.has(parsedLine.productId)) {
        return EMPTY_CART;
      }

      productIds.add(parsedLine.productId);
      parsedLines.push(parsedLine);
    }

    return { lines: parsedLines };
  } catch {
    return EMPTY_CART;
  }
}

function getBrowserStorage(): CartStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadCart(storage = getBrowserStorage()): CartState {
  if (storage === undefined) {
    return EMPTY_CART;
  }

  try {
    return parseStoredCart(storage.getItem(CART_STORAGE_KEY));
  } catch {
    return EMPTY_CART;
  }
}

export function saveCart(
  state: CartState,
  storage = getBrowserStorage(),
): void {
  if (storage === undefined) {
    return;
  }

  const persistedCart: PersistedCart = {
    version: CART_STORAGE_VERSION,
    lines: state.lines,
  };

  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(persistedCart));
  } catch {
    // Storage can be disabled or full. The in-memory cart remains usable.
  }
}
