import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrderStatus, OrderApiError } from "@/features/orders/order.api";
import type { OrderStatusResponse } from "@/features/orders/order.validation";

const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export function CheckoutConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");

  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(orderId !== null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === null) {
      return;
    }

    let isMounted = true;
    let pollCount = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function checkStatus() {
      if (!orderId) {
        return;
      }

      getOrderStatus(orderId)
        .then((status) => {
          if (!isMounted) {
            return;
          }
          setOrderStatus(status);
          setIsLoading(false);
          setErrorMessage(null);

          if (
            (status.paymentStatus === "awaiting_payment" ||
              status.paymentStatus === "ambiguous") &&
            pollCount < MAX_POLL_ATTEMPTS
          ) {
            pollCount += 1;
            timerId = setTimeout(checkStatus, POLL_INTERVAL_MS);
          }
        })
        .catch((error: unknown) => {
          if (!isMounted) {
            return;
          }
          setIsLoading(false);
          setErrorMessage(
            error instanceof OrderApiError
              ? error.message
              : "Unable to retrieve order status.",
          );
        });
    }

    checkStatus();

    return () => {
      isMounted = false;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [orderId]);

  if (orderId === null) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Card className="mt-8">
          <CardHeader>
            <CardTitle level={2}>No order specified</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              No order reference was provided in the URL.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/">Return to shop</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  const isPaid = orderStatus?.paymentStatus === "paid";
  const isFailed = orderStatus?.paymentStatus === "failed";

  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      aria-labelledby="confirmation-title"
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Order confirmation
      </p>
      <h1
        id="confirmation-title"
        className="font-display text-4xl font-semibold sm:text-5xl"
      >
        {isPaid
          ? "Payment confirmed"
          : isFailed
            ? "Payment unsuccessful"
            : "Processing payment"}
      </h1>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Completed</Badge>
            {isPaid ? (
              <Badge>Paid</Badge>
            ) : isFailed ? (
              <Badge variant="destructive">Payment failed</Badge>
            ) : (
              <Badge variant="outline">
                {isLoading ? "Checking payment…" : "Awaiting payment"}
              </Badge>
            )}
          </div>
          <CardTitle level={2}>
            {isPaid
              ? "Thank you for your order"
              : isFailed
                ? "Your payment could not be completed"
                : "Awaiting confirmation from JazzCash"}
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            {isPaid
              ? "Your card payment was processed securely via JazzCash."
              : isFailed
                ? "The transaction was declined or cancelled. You may retry payment."
                : "We are waiting to confirm your payment with the gateway. This page will refresh automatically."}
          </p>
        </CardHeader>

        {orderStatus !== null ? (
          <CardContent>
            <dl className="grid gap-4 rounded-2xl bg-muted/55 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Order reference</dt>
                <dd className="mt-1 font-semibold">{orderStatus.reference}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Payment status</dt>
                <dd className="mt-1 font-semibold capitalize">
                  {orderStatus.paymentStatus.replace("_", " ")}
                </dd>
              </div>
            </dl>
          </CardContent>
        ) : null}

        {errorMessage !== null ? (
          <CardContent>
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        ) : null}

        <CardFooter className="flex-col gap-3 sm:flex-row">
          {isFailed ? (
            <Button asChild className="w-full">
              <a href={`/api/orders/${orderId}/payment/redirect`}>
                Retry card payment
              </a>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/">Continue shopping</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to="/admin">View completed orders</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
