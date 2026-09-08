import { Route, Routes } from "react-router";

import { AdminPage } from "@/pages/AdminPage";
import { CartPage } from "@/pages/CartPage";
import { CataloguePage } from "@/pages/CataloguePage";
import { CheckoutConfirmationPage } from "@/pages/CheckoutConfirmationPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<CataloguePage />} />
      <Route path="cart" element={<CartPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="checkout/confirmation" element={<CheckoutConfirmationPage />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
