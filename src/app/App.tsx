import { useEffect, useRef } from "react";
import { BrowserRouter, useLocation } from "react-router";

import { AppRoutes } from "@/app/AppRoutes";
import { AppHeader } from "@/components/layout/AppHeader";
import { CartProvider } from "@/features/cart/CartContext";

function RouteFocusManager() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return null;
}

export function App() {
  useEffect(() => {
    document.title = "Common Goods";
  }, []);

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <RouteFocusManager />
          <a
            href="#main-content"
            className="sr-only z-50 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to main content
          </a>
          <AppHeader />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <AppRoutes />
          </main>
          <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Common Goods demonstration shop
          </footer>
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}
