import { ProductCard } from "@/components/products/ProductCard";
import { products } from "@/data/products";

export function CataloguePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <section aria-labelledby="catalogue-heading">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-accent">
            Thoughtful daily objects
          </p>
          <h1
            id="catalogue-heading"
            className="font-display text-4xl font-bold leading-tight tracking-tight text-primary sm:text-5xl"
          >
            Useful goods, chosen to last.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Three dependable essentials for work, travel, and everyday life.
            Simple choices, clear prices, and no distractions.
          </p>
        </div>

        <h2 className="sr-only">Available products</h2>
        <ul className="mt-10 grid list-none items-stretch gap-6 p-0 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id} className="h-full">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
