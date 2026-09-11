import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  catalogueProductById,
  isProductId,
} from "../../shared/catalogue.js";
import {
  DEMO_CUSTOMER,
  MAX_ORDER_LINES,
  MAX_ORDER_QUANTITY,
  type CompletedOrder,
  type CompletedOrderItem,
  type CreateOrderRequest,
} from "../../shared/orders.js";
import type {
  OrderRepository,
  PersistOrderResult,
} from "./order.repository.js";

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export interface OrderIdentifiers {
  readonly id: string;
  readonly reference: string;
}

export interface OrderServiceDependencies {
  readonly now?: () => Date;
  readonly createIdentifiers?: () => OrderIdentifiers;
}

function createOrderIdentifiers(): OrderIdentifiers {
  return {
    id: `ord_${randomUUID()}`,
    reference: `CG-${randomBytes(5).toString("hex").toUpperCase().slice(0, 8)}`,
  };
}

function validateRequest(request: CreateOrderRequest): void {
  if (
    typeof request.idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      request.idempotencyKey,
    )
  ) {
    throw new OrderValidationError("The idempotency key is invalid.");
  }
  if (request.demoCustomerId !== DEMO_CUSTOMER.id) {
    throw new OrderValidationError("The demo customer is invalid.");
  }
  if (
    !Array.isArray(request.lines) ||
    request.lines.length < 1 ||
    request.lines.length > MAX_ORDER_LINES
  ) {
    throw new OrderValidationError("The order must contain a valid number of lines.");
  }
}

function createItems(request: CreateOrderRequest): readonly CompletedOrderItem[] {
  const seenProductIds = new Set<string>();
  return request.lines.map((line) => {
    if (!isProductId(line.productId)) {
      throw new OrderValidationError("The order contains an unknown product.");
    }
    if (seenProductIds.has(line.productId)) {
      throw new OrderValidationError("Each product may appear only once.");
    }
    seenProductIds.add(line.productId);
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_ORDER_QUANTITY
    ) {
      throw new OrderValidationError("An order quantity is invalid.");
    }

    const product = catalogueProductById.get(line.productId);
    if (product === undefined) {
      throw new OrderValidationError("The order contains an unknown product.");
    }
    return {
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      lineTotalCents: product.priceCents * line.quantity,
    };
  });
}

function fingerprintRequest(request: CreateOrderRequest): string {
  const canonicalLines = [...request.lines]
    .sort((left, right) => left.productId.localeCompare(right.productId))
    .map((line) => `${line.productId}:${line.quantity}`)
    .join("|");
  return createHash("sha256")
    .update(`${request.demoCustomerId}|${canonicalLines}`, "utf8")
    .digest("hex");
}

export class OrderService {
  readonly #repository: OrderRepository;
  readonly #now: () => Date;
  readonly #createIdentifiers: () => OrderIdentifiers;

  constructor(
    repository: OrderRepository,
    dependencies: OrderServiceDependencies = {},
  ) {
    this.#repository = repository;
    this.#now = dependencies.now ?? (() => new Date());
    this.#createIdentifiers =
      dependencies.createIdentifiers ?? createOrderIdentifiers;
  }

  create(request: CreateOrderRequest): PersistOrderResult {
    validateRequest(request);
    const items = createItems(request);
    const identifiers = this.#createIdentifiers();
    const subtotalCents = items.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    );
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);

    return this.#repository.createOrReplay({
      ...identifiers,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: fingerprintRequest(request),
      createdAt: this.#now().toISOString(),
      subtotalCents,
      itemCount,
      items,
    });
  }

  findById(orderId: string): CompletedOrder | undefined {
    return this.#repository.findById(orderId);
  }

  listCompleted(limit: number): readonly CompletedOrder[] {
    return this.#repository.listCompleted(limit);
  }
}
