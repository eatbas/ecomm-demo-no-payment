import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="mx-auto flex w-full max-w-2xl flex-col items-start px-4 py-20 sm:px-6 lg:px-8"
    >
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
        404
      </p>
      <h1
        id="not-found-heading"
        className="mt-3 font-display text-4xl font-bold tracking-tight text-primary"
      >
        This page could not be found.
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        The address may be incorrect, or the page may have moved.
      </p>
      <Button asChild className="mt-8">
        <Link to="/">Return to the shop</Link>
      </Button>
    </section>
  );
}
