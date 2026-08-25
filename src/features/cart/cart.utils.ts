import { productById } from "@/data/products";
import type { CartState } from "@/features/cart/cart.types";
import type { Product } from "@/types/product";

export interface CartItem {
  readonly product: Product;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

export interface CartTotals {
  readonly items: readonly CartItem[];
  readonly itemCount: number;
  readonly subtotalCents: number;
}

export function deriveCartTotals(state: CartState): CartTotals {
  const items = state.lines.flatMap((line): CartItem[] => {
    const product = productById.get(line.productId);

    return product === undefined
      ? []
      : [
          {
            product,
            quantity: line.quantity,
            lineTotalCents: product.priceCents * line.quantity,
          },
        ];
  });

  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalCents: items.reduce(
      (subtotal, item) => subtotal + item.lineTotalCents,
      0,
    ),
  };
}
