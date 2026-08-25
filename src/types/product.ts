export type ProductId =
  | "everyday-backpack"
  | "desk-lamp"
  | "travel-mug";

export interface Product {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly imagePath: string;
  readonly imageAlt: string;
}
