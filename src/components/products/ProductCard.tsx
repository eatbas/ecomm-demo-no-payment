import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCart } from "@/features/cart/CartContext";
import { formatCurrency } from "@/lib/currency";
import type { Product } from "@/types/product";

interface ProductCardProps {
  readonly product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const cart = useCart();
  const [confirmation, setConfirmation] = useState("");

  function handleAddToCart() {
    cart.addItem(product.id);
    setConfirmation(`${product.name} added to your cart.`);
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="aspect-[4/3] overflow-hidden bg-secondary/60">
        <img
          src={product.imagePath}
          alt={product.imageAlt}
          width="640"
          height="480"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02] motion-reduce:transition-none"
        />
      </div>
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <Badge variant="secondary">Everyday essential</Badge>
          <p className="shrink-0 text-lg font-bold text-primary">
            {formatCurrency(product.priceCents)}
          </p>
        </div>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <p
          role="status"
          aria-live="polite"
          className="min-h-6 text-sm font-medium text-primary"
        >
          {confirmation}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          className="w-full"
          aria-label={`Add ${product.name} to cart`}
          onClick={handleAddToCart}
        >
          Add to cart
        </Button>
      </CardFooter>
    </Card>
  );
}
