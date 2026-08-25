import { Route, Routes } from "react-router";

import { CartPage } from "@/pages/CartPage";
import { CataloguePage } from "@/pages/CataloguePage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<CataloguePage />} />
      <Route path="cart" element={<CartPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
