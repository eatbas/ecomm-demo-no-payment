import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/features/cart/CartContext";
import { MAX_CART_QUANTITY } from "@/features/cart/cart.types";
import { formatCurrency } from "@/lib/currency";

export function CartPage() {
  const {
    items,
    itemCount,
    subtotalCents,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
  } = useCart();

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6" aria-labelledby="cart-title">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Your basket
        </p>
        <h1 id="cart-title" className="font-display text-4xl font-semibold">
          Your cart is empty
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
          Browse our three everyday essentials and add something useful to your
          cart.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">Return to the shop</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="cart-title">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Your basket
          </p>
          <h1 id="cart-title" className="font-display text-4xl font-semibold sm:text-5xl">
            Shopping cart
          </h1>
          <p className="mt-3 text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={clearCart}>
          Clear cart
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <ul className="space-y-4" aria-label="Cart items">
          {items.map(({ product, quantity, lineTotalCents }) => (
            <li key={product.id}>
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
                        <h2 className="text-lg font-semibold">{product.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCurrency(product.priceCents)} each
                        </p>
                      </div>
                      <p className="font-semibold" aria-label={`Line total for ${product.name}`}>
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
                          onClick={() => decrementItem(product.id)}
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
                          onClick={() => incrementItem(product.id)}
                        >
                          <span aria-hidden="true">+</span>
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(product.id)}
                      >
                        Remove {product.name}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <Card>
          <CardHeader>
            <CardTitle>Cart summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotalCents)}</strong>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This demonstration does not calculate delivery or taxes.
            </p>
            <Separator className="my-5" />
            <p className="text-sm leading-6 text-muted-foreground">
              Checkout is provided only to show the next page. No order or
              payment can be submitted.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button asChild size="lg" className="w-full">
              <Link to="/checkout">Review checkout</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Continue shopping</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
