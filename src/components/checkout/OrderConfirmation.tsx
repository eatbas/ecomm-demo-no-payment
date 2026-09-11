import { Link } from "react-router";

import type { CompletedOrder } from "../../../shared/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";

interface OrderConfirmationProps {
  readonly order: CompletedOrder;
}

export function OrderConfirmation({ order }: OrderConfirmationProps) {
  const isPaid = order.paymentStatus === "paid";
  const isFailed = order.paymentStatus === "failed";
  const paymentBadgeLabel =
    order.paymentStatus === "paid"
      ? "Paid"
      : order.paymentStatus === "failed"
        ? "Payment failed"
        : order.paymentStatus === "ambiguous"
          ? "Payment pending"
          : "Awaiting payment";

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Completed</Badge>
          <Badge variant={isPaid ? "default" : isFailed ? "destructive" : "outline"}>
            {paymentBadgeLabel}
          </Badge>
        </div>
        <CardTitle level={2}>
          {isPaid ? "Order confirmed and paid" : "Demo order completed"}
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          {isPaid
            ? "Your card payment was successfully processed via JazzCash."
            : "Your order was saved and is awaiting payment confirmation."}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 rounded-2xl bg-muted/55 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Order reference</dt>
            <dd className="mt-1 font-semibold">{order.reference}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Order total</dt>
            <dd className="mt-1 font-semibold">
              {formatCurrency(order.subtotalCents)}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex-col gap-3 sm:flex-row">
        <Button asChild className="w-full">
          <Link to="/">Continue shopping</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/admin">View completed orders</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
