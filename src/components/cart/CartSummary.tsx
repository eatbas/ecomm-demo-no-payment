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
import { formatCurrency } from "@/lib/currency";

interface CartSummaryProps {
  readonly subtotalCents: number;
}

export function CartSummary({ subtotalCents }: CartSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Cart summary</CardTitle>
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
          Checkout can save a synthetic demo order. It does not collect or confirm
          payment.
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
  );
}
