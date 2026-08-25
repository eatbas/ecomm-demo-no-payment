import type { Product, ProductId } from "@/types/product";

export const products = [
  {
    id: "everyday-backpack",
    name: "Everyday backpack",
    description:
      "A hard-wearing canvas backpack with a padded laptop sleeve and practical internal pockets.",
    priceCents: 7900,
    imagePath: "/products/backpack.svg",
    imageAlt: "Forest green canvas backpack with tan straps",
  },
  {
    id: "desk-lamp",
    name: "Adjustable desk lamp",
    description:
      "A compact metal desk lamp with a warm finish and an adjustable shade for focused light.",
    priceCents: 5450,
    imagePath: "/products/desk-lamp.svg",
    imageAlt: "Terracotta adjustable desk lamp on a round base",
  },
  {
    id: "travel-mug",
    name: "Insulated travel mug",
    description:
      "A double-walled stainless steel mug with a secure lid, sized for daily journeys.",
    priceCents: 2895,
    imagePath: "/products/travel-mug.svg",
    imageAlt: "Cream insulated travel mug with a dark green lid",
  },
] as const satisfies readonly [Product, Product, Product];

export const productById: ReadonlyMap<ProductId, Product> = new Map(
  products.map((product) => [product.id, product]),
);

export function isProductId(value: unknown): value is ProductId {
  return typeof value === "string" && productById.has(value as ProductId);
}
