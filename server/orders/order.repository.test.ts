// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_CUSTOMER, type CreateOrderRequest } from "../../shared/orders.js";
import { openOrderDatabase } from "../db/database.js";
import { IdempotencyConflictError, OrderRepository } from "./order.repository.js";
import { OrderService } from "./order.service.js";

const temporaryDirectories: string[] = [];

function createRepository(databasePath = ":memory:"): OrderRepository {
  return new OrderRepository(openOrderDatabase(databasePath));
}

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "ecomm-orders-repository-"));
  temporaryDirectories.push(directory);
  return join(directory, "orders.sqlite");
}

function createRequest(
  idempotencyKey = "00000000-0000-4000-8000-000000000001",
): CreateOrderRequest {
  return {
    idempotencyKey,
    demoCustomerId: DEMO_CUSTOMER.id,
    lines: [
      { productId: "everyday-backpack", quantity: 2 },
      { productId: "travel-mug", quantity: 1 },
    ],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("OrderRepository", () => {
  it("stores authoritative catalogue snapshots and replays one idempotent order", () => {
    const repository = createRepository();
    const service = new OrderService(repository, {
      now: () => new Date("2026-08-25T10:00:00.000Z"),
      createIdentifiers: () => ({
        id: "ord_00000000-0000-4000-8000-000000000101",
        reference: "CG-00000101",
      }),
    });

    const first = service.create(createRequest());
    const replay = service.create(createRequest());

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.order).toEqual(first.order);
    expect(first.order.subtotalCents).toBe(18_695);
    expect(first.order.itemCount).toBe(3);
    expect(first.order.items[0]).toMatchObject({
      productName: "Everyday backpack",
      unitPriceCents: 7_900,
      lineTotalCents: 15_800,
    });
    expect(repository.listCompleted(100)).toHaveLength(1);
    repository.close();
  });

  it("rejects reuse of an idempotency key with different lines", () => {
    const repository = createRepository();
    const service = new OrderService(repository);
    service.create(createRequest());

    expect(() =>
      service.create({
        ...createRequest(),
        lines: [{ productId: "desk-lamp", quantity: 1 }],
      }),
    ).toThrow(IdempotencyConflictError);
    expect(repository.listCompleted(100)).toHaveLength(1);
    repository.close();
  });

  it("rolls back the parent when an item insert fails", () => {
    const repository = createRepository();
    const duplicateItem = {
      productId: "travel-mug" as const,
      productName: "Insulated travel mug",
      unitPriceCents: 2_895,
      quantity: 1,
      lineTotalCents: 2_895,
    };

    expect(() =>
      repository.createOrReplay({
        id: "ord_00000000-0000-4000-8000-000000000201",
        reference: "CG-00000201",
        idempotencyKey: "00000000-0000-4000-8000-000000000201",
        requestFingerprint: "test-fingerprint",
        createdAt: "2026-08-25T10:00:00.000Z",
        subtotalCents: 5_790,
        itemCount: 2,
        items: [duplicateItem, duplicateItem],
      }),
    ).toThrow();
    expect(repository.listCompleted(100)).toEqual([]);
    repository.close();
  });

  it("persists across reopen and lists only the newest bounded results", () => {
    const databasePath = createDatabasePath();
    const repository = createRepository(databasePath);
    const dates = [
      "2026-08-25T08:00:00.000Z",
      "2026-08-25T09:00:00.000Z",
      "2026-08-25T10:00:00.000Z",
    ];
    let index = 0;
    const service = new OrderService(repository, {
      now: () => new Date(dates[index - 1] ?? dates[2]!),
      createIdentifiers: () => {
        index += 1;
        return {
          id: `ord_00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          reference: `CG-${String(index).padStart(8, "0")}`,
        };
      },
    });
    for (let orderIndex = 1; orderIndex <= 3; orderIndex += 1) {
      service.create(
        createRequest(
          `00000000-0000-4000-8000-${String(orderIndex).padStart(12, "0")}`,
        ),
      );
    }
    repository.close();

    const reopenedRepository = createRepository(databasePath);
    expect(
      reopenedRepository.listCompleted(2).map((order) => order.reference),
    ).toEqual(["CG-00000003", "CG-00000002"]);
    reopenedRepository.close();
    expect(reopenedRepository.isReady).toBe(false);
  });

  it("reads immutable snapshots for products no longer in the catalogue", () => {
    const repository = createRepository();
    repository.createOrReplay({
      id: "ord_00000000-0000-4000-8000-000000000401",
      reference: "CG-00000401",
      idempotencyKey: "00000000-0000-4000-8000-000000000401",
      requestFingerprint: "retired-product-fingerprint",
      createdAt: "2026-08-25T11:00:00.000Z",
      subtotalCents: 1_250,
      itemCount: 1,
      items: [
        {
          productId: "retired-product",
          productName: "Retired demonstration product",
          unitPriceCents: 1_250,
          quantity: 1,
          lineTotalCents: 1_250,
        },
      ],
    });

    expect(repository.listCompleted(1)[0]?.items).toEqual([
      {
        productId: "retired-product",
        productName: "Retired demonstration product",
        unitPriceCents: 1_250,
        quantity: 1,
        lineTotalCents: 1_250,
      },
    ]);
    repository.close();
  });
});
