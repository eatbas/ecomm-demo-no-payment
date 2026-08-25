import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import { cartReducer } from "@/features/cart/cart.reducer";
import { loadCart, saveCart } from "@/features/cart/cart.storage";
import type { CartLine } from "@/features/cart/cart.types";
import {
  deriveCartTotals,
  type CartItem,
} from "@/features/cart/cart.utils";
import type { ProductId } from "@/types/product";

export interface CartContextValue {
  readonly lines: readonly CartLine[];
  readonly items: readonly CartItem[];
  readonly itemCount: number;
  readonly subtotalCents: number;
  addItem(this: void, productId: ProductId): void;
  incrementItem(this: void, productId: ProductId): void;
  decrementItem(this: void, productId: ProductId): void;
  removeItem(this: void, productId: ProductId): void;
  clearCart(this: void): void;
}

const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  readonly children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart);

  useEffect(() => {
    saveCart(state);
  }, [state]);

  const addItem = useCallback((productId: ProductId) => {
    dispatch({ type: "add", productId });
  }, []);

  const incrementItem = useCallback((productId: ProductId) => {
    dispatch({ type: "increment", productId });
  }, []);

  const decrementItem = useCallback((productId: ProductId) => {
    dispatch({ type: "decrement", productId });
  }, []);

  const removeItem = useCallback((productId: ProductId) => {
    dispatch({ type: "remove", productId });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const totals = useMemo(() => deriveCartTotals(state), [state]);
  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      ...totals,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
    }),
    [
      state.lines,
      totals,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);

  if (value === null) {
    throw new Error("useCart must be used within a CartProvider.");
  }

  return value;
}
