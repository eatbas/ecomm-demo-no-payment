import type { ReactNode } from "react";

import { CartProvider } from "@/features/cart/CartContext";
import { ToastProvider } from "@/features/toast/ToastContext";

interface AppProvidersProps {
  readonly children: ReactNode;
}

/** Single composition point for the shell's client-side state providers. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <CartProvider>
      <ToastProvider>{children}</ToastProvider>
    </CartProvider>
  );
}
