import { Link, NavLink } from "react-router";

import { Badge } from "@/components/ui/badge";
import { useCart } from "@/features/cart/CartContext";
import { cn } from "@/lib/utils";

const navigationLinkClasses =
  "rounded-full px-4 py-2 text-sm font-semibold outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none";

export function AppHeader() {
  const { itemCount } = useCart();
  const cartLabel = `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <header className="border-b border-border bg-card/95">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="rounded-md font-display text-xl font-bold tracking-tight text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-2xl"
        >
          Common Goods
        </Link>

        <nav aria-label="Primary navigation" className="shrink-0">
          <ul className="flex items-center gap-1 sm:gap-2">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  cn(navigationLinkClasses, isActive && "bg-secondary")
                }
              >
                Shop
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/cart"
                aria-label={cartLabel}
                className={({ isActive }) =>
                  cn(
                    navigationLinkClasses,
                    "inline-flex items-center gap-2",
                    isActive && "bg-secondary",
                  )
                }
              >
                <span>Cart</span>
                <Badge
                  aria-hidden="true"
                  className="min-w-[2.25rem] justify-center px-2 tabular-nums"
                >
                  {itemCount}
                </Badge>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
