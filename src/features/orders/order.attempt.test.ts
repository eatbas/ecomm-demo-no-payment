import { describe, expect, it } from "vitest";

import {
  clearOrderAttempt,
  loadOrderAttempt,
  saveOrderAttempt,
} from "@/features/orders/order.attempt";
import { TEST_CUSTOMER } from "@/test/orders";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("order attempt storage", () => {
  it("round-trips a strict pending attempt and clears only the matching key", () => {
    const storage = memoryStorage();
    const attempt = {
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      customer: TEST_CUSTOMER,
      lines: [{ productId: "everyday-backpack" as const, quantity: 2 }],
    };

    saveOrderAttempt(attempt, storage);
    expect(loadOrderAttempt(storage)).toEqual(attempt);

    expect(
      clearOrderAttempt("123e4567-e89b-42d3-a456-426614174999", storage),
    ).toBe(false);
    expect(loadOrderAttempt(storage)).toEqual(attempt);

    expect(clearOrderAttempt(attempt.idempotencyKey, storage)).toBe(true);
    expect(loadOrderAttempt(storage)).toBeNull();
  });

  it("rejects malformed, duplicate, or unknown persisted lines", () => {
    const storage = memoryStorage();
    storage.setItem(
      "ecomm-demo:order-attempt:v2",
      JSON.stringify({
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        customer: TEST_CUSTOMER,
        lines: [
          { productId: "retired-product", quantity: 1 },
          { productId: "retired-product", quantity: 1 },
        ],
      }),
    );

    expect(loadOrderAttempt(storage)).toBeNull();
  });

  it("rejects a persisted attempt with invalid customer details", () => {
    const storage = memoryStorage();
    storage.setItem(
      "ecomm-demo:order-attempt:v2",
      JSON.stringify({
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        customer: { ...TEST_CUSTOMER, email: "not-an-email" },
        lines: [{ productId: "everyday-backpack", quantity: 1 }],
      }),
    );

    expect(loadOrderAttempt(storage)).toBeNull();
  });
});
