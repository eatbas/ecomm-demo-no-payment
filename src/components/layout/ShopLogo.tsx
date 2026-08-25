import { cn } from "@/lib/utils";

interface ShopLogoProps {
  readonly className?: string;
}

export function ShopLogo({ className }: ShopLogoProps) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={40}
      height={40}
      className={cn("size-8", className)}
    />
  );
}
