// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

const validRequest = {
  idempotencyKey: "00000000-0000-4000-8000-000000000301",
  demoCustomerId: "demo-customer",
  lines: [{ productId: "desk-lamp", quantity: 2 }],
};

async function createTestApp(): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const app = await buildApp({ databasePath: ":memory:" });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("order routes", () => {
  it("creates once, replays the result, and exposes it publicly to admin", async () => {
    const app = await createTestApp();
    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload: validRequest,
    });
    const replayResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload: validRequest,
    });
    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/admin/orders?limit=1",
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(replayResponse.statusCode).toBe(201);
    expect(replayResponse.json()).toEqual(firstResponse.json());
    expect(firstResponse.json()).toMatchObject({
      status: "completed",
      paymentStatus: "not_configured",
      currency: "EUR",
      subtotalCents: 10_900,
      itemCount: 2,
      items: [
        {
          productName: "Adjustable desk lamp",
          unitPriceCents: 5_450,
          quantity: 2,
          lineTotalCents: 10_900,
        },
      ],
    });
    expect(firstResponse.headers["cache-control"]).toBe("no-store");
    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.headers["cache-control"]).toBe("no-store");
    expect(adminResponse.json()).toEqual({ orders: [firstResponse.json()] });
  });

  it.each([
    ["unknown keys", { ...validRequest, subtotalCents: 1 }],
    ["unknown products", { ...validRequest, lines: [{ productId: "fake", quantity: 1 }] }],
    ["invalid quantities", { ...validRequest, lines: [{ productId: "desk-lamp", quantity: 0 }] }],
    [
      "duplicate products",
      {
        ...validRequest,
        lines: [
          { productId: "desk-lamp", quantity: 1 },
          { productId: "desk-lamp", quantity: 2 },
        ],
      },
    ],
    ["arbitrary customers", { ...validRequest, demoCustomerId: "real-customer" }],
    ["non-canonical idempotency keys", { ...validRequest, idempotencyKey: "invalid-key-value" }],
  ])("rejects %s", async (_description, payload) => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toMatch(/^INVALID_/);
  });

  it("rejects malformed, wrongly typed, and oversized bodies without leaking details", async () => {
    const app = await createTestApp();
    const malformed = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });
    const wrongContentType = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "content-type": "text/plain" },
      payload: JSON.stringify(validRequest),
    });
    const oversized = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ ...validRequest, padding: "x".repeat(20_000) }),
    });

    expect(malformed.statusCode).toBe(400);
    expect(wrongContentType.statusCode).toBe(415);
    expect(oversized.statusCode).toBe(413);
    expect(malformed.body).not.toContain("not-json");
  });

  it("rejects changed content for a used idempotency key", async () => {
    const app = await createTestApp();
    await app.inject({ method: "POST", url: "/api/orders", payload: validRequest });
    const response = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload: {
        ...validRequest,
        lines: [{ productId: "desk-lamp", quantity: 3 }],
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "IDEMPOTENCY_CONFLICT",
      message: "The idempotency key has already been used for another order.",
    });
  });

  it("bounds and validates the unauthenticated newest-order query", async () => {
    const app = await createTestApp();
    const noCredentials = await app.inject({
      method: "GET",
      url: "/api/admin/orders",
    });
    const excessive = await app.inject({
      method: "GET",
      url: "/api/admin/orders?limit=101",
    });
    const unknownQuery = await app.inject({
      method: "GET",
      url: "/api/admin/orders?cursor=secret",
    });

    expect(noCredentials.statusCode).toBe(200);
    expect(noCredentials.json()).toEqual({ orders: [] });
    expect(excessive.statusCode).toBe(400);
    expect(unknownQuery.statusCode).toBe(400);
  });

  it("reports database-backed readiness and applies security headers", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("ok\n");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["permissions-policy"]).toContain("payment=()");
    expect(response.headers["content-security-policy"]).toContain(
      "connect-src 'self'",
    );
  });

  it("returns bounded non-leaking 404 responses", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    });
  });
});
