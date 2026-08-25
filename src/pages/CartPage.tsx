import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/CartContext";
import { useCartRemovalFeedback } from "@/pages/useCartRemovalFeedback";

export function CartPage() {
  const cart = useCart();
  const feedback = useCartRemovalFeedback(cart.items, cart);

  return (
    <>
      <p
        className="sr-only"
        role="status"
        aria-label="Cart update"
        aria-live="polite"
      >
        <span key={feedback.announcement.id}>
          {feedback.announcement.message}
        </span>
      </p>
      {cart.items.length === 0 ? (
        <EmptyCartState titleRef={feedback.emptyTitle} />
      ) : (
        <section
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
          aria-labelledby="cart-title"
        >
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                Your basket
              </p>
              <h1
                id="cart-title"
                className="font-display text-4xl font-semibold sm:text-5xl"
              >
                Shopping cart
              </h1>
              <p className="mt-3 text-muted-foreground">
                {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} in
                your cart
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => feedback.clearCart()}
            >
              Clear cart
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <ul className="space-y-4" aria-label="Cart items">
              {cart.items.map((item, index) => (
                <li key={item.product.id}>
                  <CartLineItem
                    item={item}
                    titleRef={(element) =>
                      feedback.registerLineTitle(item.product.id, element)
                    }
                    onDecrement={() => feedback.decrementItem(item, index)}
                    onIncrement={() => cart.incrementItem(item.product.id)}
                    onRemove={() => feedback.removeItem(item, index)}
                  />
                </li>
              ))}
            </ul>
            <CartSummary subtotalCents={cart.subtotalCents} />
          </div>
        </section>
      )}
    </>
  );
}
