import {
  EMPTY_CART,
  MAX_CART_QUANTITY,
  type CartAction,
  type CartLine,
  type CartState,
} from "@/features/cart/cart.types";

function replaceLine(
  lines: readonly CartLine[],
  productId: CartLine["productId"],
  updateQuantity: (quantity: number) => number,
): readonly CartLine[] {
  return lines.map((line) =>
    line.productId === productId
      ? { ...line, quantity: updateQuantity(line.quantity) }
      : line,
  );
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const existingLine = state.lines.find(
        (line) => line.productId === action.productId,
      );

      if (existingLine === undefined) {
        return {
          lines: [...state.lines, { productId: action.productId, quantity: 1 }],
        };
      }

      if (existingLine.quantity >= MAX_CART_QUANTITY) {
        return state;
      }

      return {
        lines: replaceLine(
          state.lines,
          action.productId,
          (quantity) => quantity + 1,
        ),
      };
    }

    case "increment": {
      const existingLine = state.lines.find(
        (line) => line.productId === action.productId,
      );

      if (
        existingLine === undefined ||
        existingLine.quantity >= MAX_CART_QUANTITY
      ) {
        return state;
      }

      return {
        lines: replaceLine(
          state.lines,
          action.productId,
          (quantity) => quantity + 1,
        ),
      };
    }

    case "decrement": {
      const existingLine = state.lines.find(
        (line) => line.productId === action.productId,
      );

      if (existingLine === undefined) {
        return state;
      }

      if (existingLine.quantity === 1) {
        return {
          lines: state.lines.filter(
            (line) => line.productId !== action.productId,
          ),
        };
      }

      return {
        lines: replaceLine(
          state.lines,
          action.productId,
          (quantity) => quantity - 1,
        ),
      };
    }

    case "remove": {
      if (!state.lines.some((line) => line.productId === action.productId)) {
        return state;
      }

      return {
        lines: state.lines.filter((line) => line.productId !== action.productId),
      };
    }

    case "clear":
      return state.lines.length === 0 ? state : EMPTY_CART;
  }
}
