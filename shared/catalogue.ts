// Prices are PKR paisa (the smallest PKR unit), matching shared/orders.ts's
// ORDER_CURRENCY and the unit JazzCash's pp_Amount expects directly.
export const catalogueProducts = [
  {
    id: "everyday-backpack",
    name: "Everyday backpack",
    priceCents: 7900,
  },
  {
    id: "desk-lamp",
    name: "Adjustable desk lamp",
    priceCents: 5450,
  },
  {
    id: "travel-mug",
    name: "Insulated travel mug",
    priceCents: 2895,
  },
] as const;

export type ProductId = (typeof catalogueProducts)[number]["id"];

export interface CatalogueProduct {
  readonly id: ProductId;
  readonly name: string;
  readonly priceCents: number;
}

export const catalogueProductById: ReadonlyMap<ProductId, CatalogueProduct> =
  new Map(catalogueProducts.map((product) => [product.id, product]));

export function isProductId(value: unknown): value is ProductId {
  return (
    typeof value === "string" &&
    catalogueProductById.has(value as ProductId)
  );
}
