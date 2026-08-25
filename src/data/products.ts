import {
  catalogueProducts,
  isProductId,
} from "../../shared/catalogue";
import type { Product, ProductId } from "@/types/product";

const productPresentation: Record<
  ProductId,
  Pick<Product, "description" | "imageAlt" | "imagePath">
> = {
  "everyday-backpack": {
    description:
      "A hard-wearing canvas backpack with a padded laptop sleeve and practical internal pockets.",
    imagePath: "/products/backpack.svg",
    imageAlt: "Forest green canvas backpack with tan straps",
  },
  "desk-lamp": {
    description:
      "A compact metal desk lamp with a warm finish and an adjustable shade for focused light.",
    imagePath: "/products/desk-lamp.svg",
    imageAlt: "Terracotta adjustable desk lamp on a round base",
  },
  "travel-mug": {
    description:
      "A double-walled stainless steel mug with a secure lid, sized for daily journeys.",
    imagePath: "/products/travel-mug.svg",
    imageAlt: "Cream insulated travel mug with a dark green lid",
  },
};

function addPresentation(product: (typeof catalogueProducts)[number]): Product {
  return {
    ...product,
    ...productPresentation[product.id],
  };
}

export const products = [
  addPresentation(catalogueProducts[0]),
  addPresentation(catalogueProducts[1]),
  addPresentation(catalogueProducts[2]),
] as const satisfies readonly [Product, Product, Product];

export const productById: ReadonlyMap<ProductId, Product> = new Map(
  products.map((product) => [product.id, product]),
);

export { isProductId };
