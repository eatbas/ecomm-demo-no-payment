import { useLayoutEffect, useRef, useState } from "react";

import type { CartContextValue } from "@/features/cart/CartContext";
import type { CartItem } from "@/features/cart/cart.utils";
import type { ProductId } from "@/types/product";

type CartActions = Pick<
  CartContextValue,
  "clearCart" | "decrementItem" | "removeItem"
>;

interface Announcement {
  readonly id: number;
  readonly message: string;
}

export function useCartRemovalFeedback(
  items: readonly CartItem[],
  actions: CartActions,
) {
  const lineTitles = useRef(new Map<ProductId, HTMLHeadingElement>());
  const emptyTitle = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<ProductId | "empty" | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement>({
    id: 0,
    message: "",
  });

  useLayoutEffect(() => {
    const focusTarget = pendingFocus.current;
    if (focusTarget === null) {
      return;
    }

    pendingFocus.current = null;
    const element =
      focusTarget === "empty"
        ? emptyTitle.current
        : lineTitles.current.get(focusTarget);
    element?.focus();
  }, [items]);

  function announce(message: string): void {
    setAnnouncement((current) => ({ id: current.id + 1, message }));
  }

  function prepareLineRemoval(item: CartItem, index: number): void {
    const remainingItems = items.filter(
      (candidate) => candidate.product.id !== item.product.id,
    );
    pendingFocus.current =
      remainingItems[Math.min(index, remainingItems.length - 1)]?.product.id ??
      "empty";
    announce(`${item.product.name} removed from your cart.`);
  }

  return {
    announcement,
    emptyTitle,
    registerLineTitle(productId: ProductId, element: HTMLHeadingElement | null) {
      if (element === null) {
        lineTitles.current.delete(productId);
      } else {
        lineTitles.current.set(productId, element);
      }
    },
    decrementItem(item: CartItem, index: number) {
      if (item.quantity === 1) {
        prepareLineRemoval(item, index);
      }
      actions.decrementItem(item.product.id);
    },
    removeItem(item: CartItem, index: number) {
      prepareLineRemoval(item, index);
      actions.removeItem(item.product.id);
    },
    clearCart() {
      pendingFocus.current = "empty";
      announce("Cart cleared.");
      actions.clearCart();
    },
  };
}
