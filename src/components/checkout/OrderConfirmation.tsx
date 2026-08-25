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
  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Completed</Badge>
          <Badge variant="outline">Payment not configured</Badge>
        </div>
        <CardTitle level={2}>Demo order completed</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          The order was saved. No payment was collected or confirmed.
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
