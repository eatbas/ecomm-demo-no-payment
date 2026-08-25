import type { ProductId } from "@/types/product";

export const MAX_CART_QUANTITY = 99;

export interface CartLine {
  readonly productId: ProductId;
  readonly quantity: number;
}

export interface CartState {
  readonly lines: readonly CartLine[];
}

export type CartAction =
  | { readonly type: "add"; readonly productId: ProductId }
  | { readonly type: "increment"; readonly productId: ProductId }
  | { readonly type: "decrement"; readonly productId: ProductId }
  | { readonly type: "remove"; readonly productId: ProductId }
  | { readonly type: "clear" };

export const EMPTY_CART: CartState = Object.freeze({ lines: Object.freeze([]) });
