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
  const isPending = order.paymentStatus === "pending";
  const isFailed = order.paymentStatus === "failed";

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === "completed" ? (
            <Badge>Completed</Badge>
          ) : order.status === "pending" ? (
            <Badge variant="secondary">Order pending</Badge>
          ) : (
            <Badge variant="destructive">Order failed</Badge>
          )}

          {isPaid ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              Paid
            </Badge>
          ) : isPending ? (
            <Badge variant="secondary">Payment pending</Badge>
          ) : isFailed ? (
            <Badge variant="destructive">Payment failed</Badge>
          ) : (
            <Badge variant="outline">Payment not configured</Badge>
          )}
        </div>
        <CardTitle level={2}>
          {isPaid
            ? "JazzCash payment successful"
            : isPending
              ? "Payment pending confirmation"
              : isFailed
                ? "Payment failed"
                : "Demo order completed"}
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          {isPaid
            ? "Your payment was processed successfully via JazzCash."
            : isPending
              ? "Your payment was submitted and is awaiting confirmation from JazzCash."
              : isFailed
                ? "The payment was declined or cancelled by JazzCash."
                : "The order was saved. No payment was collected or confirmed."}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 rounded-2xl bg-muted/55 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Order reference</dt>
            <dd className="mt-1 font-semibold">{order.reference}</dd>
          </div>
          {order.paymentStatus !== "not_configured" ? (
            <div>
              <dt className="text-sm text-muted-foreground">Payment status</dt>
              <dd className="mt-1 font-semibold capitalize">
                {order.paymentStatus}
              </dd>
            </div>
          ) : null}
          {order.subtotalCents > 0 ? (
            <div>
              <dt className="text-sm text-muted-foreground">Order total</dt>
              <dd className="mt-1 font-semibold">
                {formatCurrency(order.subtotalCents)}
              </dd>
            </div>
          ) : null}
          {order.transaction !== undefined ? (
            <div>
              <dt className="text-sm text-muted-foreground">Txn Ref No</dt>
              <dd className="mt-1 font-mono font-semibold">
                {order.transaction.txnRefNo}
              </dd>
            </div>
          ) : null}
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
