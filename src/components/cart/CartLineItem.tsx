import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_CART_QUANTITY } from "@/features/cart/cart.types";
import type { CartItem } from "@/features/cart/cart.utils";
import { formatCurrency } from "@/lib/currency";

interface CartLineItemProps {
  readonly item: CartItem;
  readonly titleRef: Ref<HTMLHeadingElement>;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
  readonly onRemove: () => void;
}

export function CartLineItem({
  item: { product, quantity, lineTotalCents },
  titleRef,
  onDecrement,
  onIncrement,
  onRemove,
}: CartLineItemProps) {
  return (
    <Card>
      <CardContent className="grid gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-6">
        <img
          src={product.imagePath}
          alt={product.imageAlt}
          width="256"
          height="256"
          className="aspect-square w-full rounded-2xl bg-muted object-cover sm:w-32"
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                ref={titleRef}
                tabIndex={-1}
                className="text-lg font-semibold focus:outline-none"
              >
                {product.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(product.priceCents)} each
              </p>
            </div>
            <p
              className="font-semibold"
              aria-label={`Line total for ${product.name}`}
            >
              {formatCurrency(lineTotalCents)}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex items-center rounded-full border border-border bg-background"
              aria-label={`Quantity controls for ${product.name}`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Decrease quantity of ${product.name}`}
                onClick={onDecrement}
              >
                <span aria-hidden="true">−</span>
              </Button>
              <output
                className="min-w-10 text-center font-semibold tabular-nums"
                aria-label={`Quantity of ${product.name}`}
                aria-live="polite"
              >
                {quantity}
              </output>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Increase quantity of ${product.name}`}
                disabled={quantity >= MAX_CART_QUANTITY}
                onClick={onIncrement}
              >
                <span aria-hidden="true">+</span>
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              Remove {product.name}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
