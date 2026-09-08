import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";

import { CheckoutCartSummary } from "@/components/checkout/CheckoutCartSummary";
import { CheckoutDetailsForm } from "@/components/checkout/CheckoutDetailsForm";
import { CheckoutPayment } from "@/components/checkout/CheckoutPayment";
import { useCart } from "@/features/cart/CartContext";
import { deriveCartTotals } from "@/features/cart/cart.utils";
import { createOrder, OrderApiError } from "@/features/orders/order.api";
import {
  clearOrderAttempt,
  loadOrderAttempt,
  saveOrderAttempt,
  type OrderAttempt,
} from "@/features/orders/order.attempt";
import { createOrderIdempotencyKey } from "@/features/orders/order.idempotency";
import { navigateTo } from "@/lib/navigation";
import { isValidCustomerDetails, type CreateOrderRequest, type CustomerDetails } from "../../shared/orders";

const BLANK_CUSTOMER: CustomerDetails = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  postcode: "",
  country: "",
};

export function CheckoutPage() {
  const { items: cartItems, removeCompletedLines } = useCart();
  const [initialAttempt] = useState(loadOrderAttempt);
  const [attempt, setAttempt] = useState<OrderAttempt | null>(initialAttempt);
  const [customer, setCustomer] = useState<CustomerDetails>(
    initialAttempt?.customer ?? BLANK_CUSTOMER,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  if (cartItems.length === 0 && attempt === null) {
    return <Navigate to="/cart" replace />;
  }

  function submitOrder(): void {
    if (isRequestPending.current) {
      return;
    }

    if (!isValidCustomerDetails(customer)) {
      setErrorMessage("Fill in every delivery and billing detail before continuing.");
      return;
    }

    const currentAttempt: OrderAttempt = attempt ?? {
      idempotencyKey: createOrderIdempotencyKey(),
      customer,
      lines: cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
    };
    setAttempt(currentAttempt);
    saveOrderAttempt(currentAttempt);

    const request: CreateOrderRequest = {
      idempotencyKey: currentAttempt.idempotencyKey,
      customer: currentAttempt.customer,
      lines: currentAttempt.lines,
    };
    isRequestPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    void createOrder(request)
      .then((order) => {
        clearOrderAttempt(request.idempotencyKey);
        removeCompletedLines(request.lines);
        if (isMounted.current) {
          setIsRedirecting(true);
        }
        navigateTo(`/api/orders/${order.id}/payment/redirect`);
      })
      .catch((error: unknown) => {
        if (isMounted.current) {
          setErrorMessage(
            error instanceof OrderApiError
              ? error.message
              : "The order could not be started. Try again.",
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
      <h1 id="checkout-title" className="font-display text-4xl font-semibold sm:text-5xl">
        Checkout
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Fill in your details, then pay by card via JazzCash.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          <CheckoutDetailsForm
            customer={customer}
            isSubmitting={isSubmitting || isRedirecting}
            onChange={setCustomer}
            onSubmit={submitOrder}
          />
        </div>

        <aside className="order-1 flex flex-col gap-6 lg:sticky lg:top-8 lg:order-2">
          <CheckoutPayment errorMessage={errorMessage} />
          <CheckoutCartSummary checkout={checkout} isSavedAttempt={attempt !== null} />
        </aside>
      </div>
    </section>
  );
}
