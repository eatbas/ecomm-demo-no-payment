import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";

import { CheckoutCartSummary } from "@/components/checkout/CheckoutCartSummary";
import { CheckoutDetailsForm } from "@/components/checkout/CheckoutDetailsForm";
import { CheckoutPayment } from "@/components/checkout/CheckoutPayment";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import { useCart } from "@/features/cart/CartContext";
import { deriveCartTotals } from "@/features/cart/cart.utils";
import { createOrder, OrderApiError } from "@/features/orders/order.api";
import {
  clearOrderAttempt,
  clearOrderCompletion,
  loadOrderAttempt,
  loadOrderCompletion,
  saveOrderAttempt,
  saveOrderCompletion,
  type OrderAttempt,
} from "@/features/orders/order.attempt";
import { createOrderIdempotencyKey } from "@/features/orders/order.idempotency";
import {
  DEMO_CUSTOMER,
  type CompletedOrder,
  type CreateOrderRequest,
} from "../../shared/orders";

export function CheckoutPage() {
  const {
    items: cartItems,
    removeCompletedLines,
  } = useCart();
  const [initialAttempt] = useState(loadOrderAttempt);
  const [attempt, setAttempt] = useState<OrderAttempt | null>(initialAttempt);
  const [isDemoAccountFilled, setIsDemoAccountFilled] = useState(
    initialAttempt !== null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<CompletedOrder | null>(loadOrderCompletion);
  const isRequestPending = useRef(false);
  const isMounted = useRef(true);
  const checkout =
    attempt === null
      ? deriveCartTotals({
          lines: cartItems.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        })
      : deriveCartTotals({ lines: attempt.lines });

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (confirmation !== null) {
      clearOrderCompletion();
    }
  }, [confirmation]);

  if (
    cartItems.length === 0 &&
    attempt === null &&
    confirmation === null
  ) {
    return <Navigate to="/cart" replace />;
  }

  function fillDemoAccount(): void {
    setIsDemoAccountFilled(true);
    setErrorMessage(null);
  }

  function submitOrder(): void {
    if (isRequestPending.current) {
      return;
    }

    if (!isDemoAccountFilled) {
      setErrorMessage("Fill the fixed demo account before completing the order.");
      return;
    }

    const currentAttempt: OrderAttempt = attempt ?? {
      idempotencyKey: createOrderIdempotencyKey(),
      lines: cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
    };
    setAttempt(currentAttempt);
    saveOrderAttempt(currentAttempt);

    const request: CreateOrderRequest = {
      idempotencyKey: currentAttempt.idempotencyKey,
      demoCustomerId: DEMO_CUSTOMER.id,
      lines: currentAttempt.lines,
    };
    isRequestPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    void createOrder(request)
      .then((order) => {
        const wasCurrentAttempt = clearOrderAttempt(request.idempotencyKey);
        if (isMounted.current) {
          clearOrderCompletion();
          setAttempt(null);
          setConfirmation(order);
        } else if (wasCurrentAttempt) {
          saveOrderCompletion(order);
        }
        removeCompletedLines(request.lines);
      })
      .catch((error: unknown) => {
        if (isMounted.current) {
          setErrorMessage(
            error instanceof OrderApiError
              ? error.message
              : "The order could not be completed. Try again.",
          );
        }
      })
      .finally(() => {
        isRequestPending.current = false;
        if (isMounted.current) {
          setIsSubmitting(false);
        }
      });
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8" aria-labelledby="checkout-title">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Public demonstration
      </p>
      <h1 id="checkout-title" className="font-display text-4xl font-semibold sm:text-5xl">
        Checkout
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Use the fixed synthetic account to save a completed demo order.
      </p>

      {confirmation === null ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] lg:items-start">
          <div className="order-2 min-w-0 lg:order-1">
            <CheckoutDetailsForm
              isDemoAccountFilled={isDemoAccountFilled}
              isSubmitting={isSubmitting}
              onFillDemoAccount={fillDemoAccount}
              onSubmit={submitOrder}
            />
          </div>

          <aside className="order-1 flex flex-col gap-6 lg:sticky lg:top-8 lg:order-2">
            <CheckoutPayment
              errorMessage={errorMessage}
              isSubmitting={isSubmitting}
              onSubmit={submitOrder}
            />
            <CheckoutCartSummary
              checkout={checkout}
              isSavedAttempt={attempt !== null}
            />
          </aside>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <OrderConfirmation order={confirmation} />
        </div>
      )}
    </section>
  );
}
