import { useEffect, useRef } from "react";
import { BrowserRouter, useLocation } from "react-router";

import { AppProviders } from "@/app/AppProviders";
import { AppRoutes } from "@/app/AppRoutes";
import { AppHeader } from "@/components/layout/AppHeader";
import { ShopLogo } from "@/components/layout/ShopLogo";
import { ToastRegion } from "@/components/toast/ToastRegion";

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

function RouteDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title =
      pathname === "/admin"
        ? "Completed orders | Common Goods"
        : "Common Goods";
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <RouteFocusManager />
          <RouteDocumentTitle />
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
            <div className="flex flex-col items-center gap-2">
              <ShopLogo className="size-8" />
              <p>Common Goods demonstration shop</p>
            </div>
          </footer>
          <ToastRegion />
        </div>
      </BrowserRouter>
    </AppProviders>
  );
}
