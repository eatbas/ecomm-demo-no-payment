import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { PaymentStatus } from "../../shared/orders";
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

const POLL_INTERVAL_MILLISECONDS = 5_000;

type ConfirmationState =
  | { readonly status: "missing" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "resolved";
      readonly paymentStatus: PaymentStatus;
      readonly reference: string;
    };

const STATUS_COPY: Record<
  PaymentStatus,
  { readonly badge: string; readonly heading: string; readonly body: string }
> = {
  awaiting_payment: {
    badge: "Awaiting payment",
    heading: "Waiting for JazzCash",
    body: "We have not heard back from JazzCash yet. This page updates automatically once your payment is confirmed.",
  },
  ambiguous: {
    badge: "Confirming",
    heading: "Confirming your payment",
    body: "JazzCash reported an update we are still confirming. This can take a few minutes — this page updates automatically.",
  },
  paid: {
    badge: "Paid",
    heading: "Payment confirmed",
    body: "Your JazzCash payment was confirmed and your order is complete.",
  },
  failed: {
    badge: "Failed",
    heading: "Payment was not completed",
    body: "JazzCash did not confirm this payment. No charge should have been made; contact support if you believe this is wrong.",
  },
};

export function CheckoutConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const [state, setState] = useState<ConfirmationState>(
    orderId === null ? { status: "missing" } : { status: "loading" },
  );

  useEffect(() => {
    if (orderId === null) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function poll(): Promise<void> {
      try {
        const result = await getOrderStatus(orderId as string, controller.signal);
        if (cancelled) {
          return;
        }
        setState({
          status: "resolved",
          paymentStatus: result.paymentStatus,
          reference: result.reference,
        });
        if (
          result.paymentStatus === "awaiting_payment" ||
          result.paymentStatus === "ambiguous"
        ) {
          timer = setTimeout(() => {
            void poll();
          }, POLL_INTERVAL_MILLISECONDS);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof OrderApiError
                ? error.message
                : "Payment status could not be checked. Try again.",
          });
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [orderId]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6" aria-labelledby="confirmation-title">
      <h1 id="confirmation-title" className="sr-only">
        Payment confirmation
      </h1>
      <Card>
        {state.status === "missing" ? (
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">No order to confirm</p>
            <p className="mt-2 text-muted-foreground">
              This page needs an order reference to check payment status.
            </p>
          </CardContent>
        ) : null}

        {state.status === "loading" ? (
          <CardContent className="p-8 text-center" role="status" aria-live="polite">
            <span
              aria-hidden="true"
              className="mx-auto mb-4 block size-8 animate-spin rounded-full border-4 border-secondary border-t-primary motion-reduce:animate-none"
            />
            <p className="font-semibold">Checking your payment…</p>
          </CardContent>
        ) : null}

        {state.status === "error" ? (
          <CardContent className="p-8 text-center" role="alert">
            <p className="text-lg font-semibold text-destructive">
              Payment status unavailable
            </p>
            <p className="mt-2 text-muted-foreground">{state.message}</p>
          </CardContent>
        ) : null}

        {state.status === "resolved" ? (
          <>
            <CardHeader>
              <Badge>{STATUS_COPY[state.paymentStatus].badge}</Badge>
              <CardTitle level={2}>{STATUS_COPY[state.paymentStatus].heading}</CardTitle>
              <p
                className="text-sm leading-6 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {STATUS_COPY[state.paymentStatus].body}
              </p>
            </CardHeader>
            <CardContent>
              <dl className="rounded-2xl bg-muted/55 p-5">
                <dt className="text-sm text-muted-foreground">Order reference</dt>
                <dd className="mt-1 font-semibold">{state.reference}</dd>
              </dl>
            </CardContent>
          </>
        ) : null}

        <CardFooter className="flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full">
            <Link to="/">Continue shopping</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
