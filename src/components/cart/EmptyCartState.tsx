import type { Ref } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

interface EmptyCartStateProps {
  readonly titleRef: Ref<HTMLHeadingElement>;
}

export function EmptyCartState({ titleRef }: EmptyCartStateProps) {
  return (
    <section
      className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6"
      aria-labelledby="cart-title"
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Your basket
      </p>
      <h1
        ref={titleRef}
        id="cart-title"
        tabIndex={-1}
        className="font-display text-4xl font-semibold focus:outline-none"
      >
        Your cart is empty
      </h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
        Browse our three everyday essentials and add something useful to your
        cart.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link to="/">Return to the shop</Link>
      </Button>
    </section>
  );
}
