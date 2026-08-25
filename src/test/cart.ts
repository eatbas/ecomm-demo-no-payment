import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
} from "@/features/cart/cart.storage";
import type { CartLine } from "@/features/cart/cart.types";

export function seedStoredCart(lines: readonly CartLine[] = []): void {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ version: CART_STORAGE_VERSION, lines }),
  );
}
