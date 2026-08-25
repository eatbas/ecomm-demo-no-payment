import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCart } from "@/features/cart/CartContext";
import { MAX_CART_QUANTITY } from "@/features/cart/cart.types";
import { useToast } from "@/features/toast/ToastContext";
import { formatCurrency } from "@/lib/currency";
import type { Product } from "@/types/product";

interface ProductCardProps {
  readonly product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const cart = useCart();
  const { showToast } = useToast();
  const quantity =
    cart.lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const isAtQuantityLimit = quantity >= MAX_CART_QUANTITY;

  function handleAddToCart() {
    if (isAtQuantityLimit) {
      return;
    }

    cart.addItem(product.id);
    showToast({
      groupKey: product.id,
      title: "Added to cart",
      description: `${product.name}, quantity ${quantity + 1}`,
    });
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
      <CardFooter>
        <Button
          type="button"
          className="w-full"
          aria-label={
            isAtQuantityLimit
              ? `${product.name} cart limit reached`
              : `Add ${product.name} to cart`
          }
          disabled={isAtQuantityLimit}
          onClick={handleAddToCart}
        >
          {isAtQuantityLimit ? "Cart limit reached" : "Add to cart"}
        </Button>
      </CardFooter>
    </Card>
  );
}
