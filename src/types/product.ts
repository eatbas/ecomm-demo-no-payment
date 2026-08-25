import type { ProductId } from "../../shared/catalogue";

export type { ProductId } from "../../shared/catalogue";

export interface Product {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly imagePath: string;
  readonly imageAlt: string;
}
