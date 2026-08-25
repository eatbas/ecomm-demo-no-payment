import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CartTotals } from "@/features/cart/cart.utils";
import { formatCurrency } from "@/lib/currency";

interface CheckoutCartSummaryProps {
  readonly checkout: CartTotals;
  readonly isSavedAttempt: boolean;
}

export function CheckoutCartSummary({
  checkout,
  isSavedAttempt,
}: CheckoutCartSummaryProps) {
  return (
    <Card>
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <CardTitle
          level={2}
          className="font-display text-2xl leading-tight tracking-tight sm:text-3xl"
        >
          Cart summary
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {checkout.itemCount} {checkout.itemCount === 1 ? "item" : "items"}
        </p>
        {isSavedAttempt ? (
          <p className="text-sm leading-6 text-muted-foreground">
            This is the saved order attempt being retried. Later cart changes
            remain separate and will not be removed.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
        <ul className="space-y-4" aria-label="Checkout item summary">
          {checkout.items.map(({ product, quantity, lineTotalCents }) => (
            <li
              key={product.id}
              className="flex items-start justify-between gap-5"
            >
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
          <strong>{formatCurrency(checkout.subtotalCents)}</strong>
        </div>
      </CardContent>
    </Card>
  );
}
