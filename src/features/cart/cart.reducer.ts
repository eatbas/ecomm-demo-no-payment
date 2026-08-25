import {
  EMPTY_CART,
  MAX_CART_QUANTITY,
  type CartAction,
  type CartLine,
  type CartState,
} from "@/features/cart/cart.types";

function isValidQuantity(quantity: number): boolean {
  return (
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_CART_QUANTITY
  );
}

function normaliseState(state: CartState): CartState {
  const validLines = state.lines.filter((line) =>
    isValidQuantity(line.quantity),
  );

  if (validLines.length === state.lines.length) {
    return state;
  }

  return validLines.length === 0 ? EMPTY_CART : { lines: validLines };
}

function findLine(state: CartState, productId: CartLine["productId"]) {
  return state.lines.find((line) => line.productId === productId);
}

function removeLine(
  state: CartState,
  productId: CartLine["productId"],
): CartState {
  return findLine(state, productId) === undefined
    ? state
    : { lines: state.lines.filter((line) => line.productId !== productId) };
}

function updateQuantity(
  state: CartState,
  productId: CartLine["productId"],
  change: -1 | 1,
): CartState {
  const line = findLine(state, productId);

  if (line === undefined) {
    return state;
  }

  const nextQuantity = line.quantity + change;
  if (nextQuantity < 1) {
    return removeLine(state, productId);
  }

  if (nextQuantity > MAX_CART_QUANTITY) {
    return state;
  }

  return {
    lines: state.lines.map((candidate) =>
      candidate.productId === productId
        ? { ...candidate, quantity: nextQuantity }
        : candidate,
    ),
  };
}

function addLine(state: CartState, productId: CartLine["productId"]): CartState {
  return findLine(state, productId) === undefined
    ? { lines: [...state.lines, { productId, quantity: 1 }] }
    : updateQuantity(state, productId, 1);
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  const validState = normaliseState(state);

  switch (action.type) {
    case "add":
      return addLine(validState, action.productId);
    case "increment":
      return updateQuantity(validState, action.productId, 1);
    case "decrement":
      return updateQuantity(validState, action.productId, -1);
    case "remove":
      return removeLine(validState, action.productId);
    case "clear":
      return validState.lines.length === 0 ? validState : EMPTY_CART;
  }
}
