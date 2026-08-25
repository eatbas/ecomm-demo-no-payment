import { Link, Navigate } from "react-router";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { formatCurrency } from "@/lib/currency";

export function CheckoutPage() {
  const { items, itemCount, subtotalCents } = useCart();

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="checkout-title">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Review only
      </p>
      <h1 id="checkout-title" className="font-display text-4xl font-semibold sm:text-5xl">
        Checkout
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Review what is in your cart. This page deliberately contains no order,
        delivery, billing, or transaction controls.
      </p>

      <Alert variant="notice" className="mt-8">
        <span aria-hidden="true">i</span>
        <AlertTitle>Payments are not available in this demo.</AlertTitle>
        <AlertDescription>
          Nothing can be purchased or submitted here. You can return to your cart
          or continue browsing the shop.
        </AlertDescription>
      </Alert>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cart summary</CardTitle>
          <p className="text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4" aria-label="Checkout item summary">
            {items.map(({ product, quantity, lineTotalCents }) => (
              <li key={product.id} className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quantity {quantity} at {formatCurrency(product.priceCents)} each
                  </p>
                </div>
                <p className="shrink-0 font-semibold">
                  {formatCurrency(lineTotalCents)}
                </p>
              </li>
            ))}
          </ul>
          <Separator className="my-6" />
          <div className="flex items-center justify-between gap-4 text-lg">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotalCents)}</strong>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full">
            <Link to="/cart">Back to cart</Link>
          </Button>
          <Button asChild className="w-full">
            <Link to="/">Continue shopping</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
