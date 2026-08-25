import { describe, expect, it } from "vitest";

import { createOrderIdempotencyKey } from "@/features/orders/order.idempotency";

describe("order idempotency keys", () => {
  it("creates distinct canonical version 4 UUIDs", () => {
    const first = createOrderIdempotencyKey();
    const second = createOrderIdempotencyKey();
    const canonicalVersionFourUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    expect(first).toMatch(canonicalVersionFourUuid);
    expect(second).toMatch(canonicalVersionFourUuid);
    expect(second).not.toBe(first);
  });
});
