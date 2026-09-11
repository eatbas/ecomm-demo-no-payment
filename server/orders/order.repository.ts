import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
  DEMO_CUSTOMER,
  MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH,
  ORDER_CURRENCY,
  ORDER_PAYMENT_STATUS,
  ORDER_SNAPSHOT_PRODUCT_ID_PATTERN,
  ORDER_STATUS,
  PAYMENT_STATUSES,
  type CompletedOrder,
  type CompletedOrderItem,
  type OrderSnapshotProductId,
  type PaymentStatus,
} from "../../shared/orders.js";

export interface OrderToPersist {
  readonly id: string;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly createdAt: string;
  readonly subtotalCents: number;
  readonly itemCount: number;
  readonly items: readonly CompletedOrderItem[];
}

export interface PersistOrderResult {
  readonly order: CompletedOrder;
  readonly created: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key has already been used for another order.");
    this.name = "IdempotencyConflictError";
  }
}

class DataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

export type DatabaseRow = Record<string, SQLOutputValue>;

export function readString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text.`);
  }
  return value;
}

export function readNullableString(
  row: DatabaseRow,
  column: string,
): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text or null.`);
  }
  return value;
}

export function readInteger(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new DataIntegrityError(`Expected ${column} to contain an integer.`);
  }
  return value;
}

function readProductId(row: DatabaseRow): OrderSnapshotProductId {
  const value = readString(row, "productId");
  if (
    value.length > MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH ||
    !ORDER_SNAPSHOT_PRODUCT_ID_PATTERN.test(value)
  ) {
    throw new DataIntegrityError("An order contains an invalid product snapshot.");
  }
  return value;
}

function mapOrderItem(row: DatabaseRow): CompletedOrderItem {
  return {
    productId: readProductId(row),
    productName: readString(row, "productName"),
    unitPriceCents: readInteger(row, "unitPriceCents"),
    quantity: readInteger(row, "quantity"),
    lineTotalCents: readInteger(row, "lineTotalCents"),
  };
}

function assertLiteral(
  row: DatabaseRow,
  column: string,
  expected: string,
): void {
  if (readString(row, column) !== expected) {
    throw new DataIntegrityError(`The stored ${column} value is invalid.`);
  }
}

export class OrderRepository {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  get database(): DatabaseSync {
    return this.#database;
  }

  get isReady(): boolean {
    return this.#database.isOpen;
  }

  close(): void {
    if (this.#database.isOpen) {
      this.#database.close();
    }
  }

  findById(orderId: string): CompletedOrder | undefined {
    const row = this.#database
      .prepare("SELECT id FROM orders WHERE id = ?")
      .get(orderId);
    return row === undefined ? undefined : this.readOrder(orderId);
  }

  createOrReplay(order: OrderToPersist): PersistOrderResult {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#database
        .prepare(
          "SELECT id, request_fingerprint AS requestFingerprint FROM orders WHERE idempotency_key = ?",
        )
        .get(order.idempotencyKey);

      if (existing !== undefined) {
        if (
          readString(existing, "requestFingerprint") !==
          order.requestFingerprint
        ) {
          throw new IdempotencyConflictError();
        }

        const persistedOrder = this.readOrder(readString(existing, "id"));
        this.#database.exec("COMMIT");
        return { order: persistedOrder, created: false };
      }

      this.insertOrder(order);
      const persistedOrder = this.readOrder(order.id);
      this.#database.exec("COMMIT");
      return { order: persistedOrder, created: true };
    } catch (error) {
      this.rollback(error);
    }
  }

  listCompleted(limit: number): readonly CompletedOrder[] {
    const orderRows = this.#database
      .prepare(
        `SELECT id
         FROM orders
         WHERE status = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(ORDER_STATUS, limit) as unknown as DatabaseRow[];

    return orderRows.map((row) => this.readOrder(readString(row, "id")));
  }

  setPaymentStatus(orderId: string, paymentStatus: PaymentStatus): void {
    const result = this.#database
      .prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
      .run(paymentStatus, orderId);
    if (result.changes === 0) {
      throw new DataIntegrityError(`Order ${orderId} could not be updated.`);
    }
  }

  private insertOrder(order: OrderToPersist): void {
    this.#database
      .prepare(
        `INSERT INTO orders (
           id, reference, idempotency_key, request_fingerprint,
           demo_customer_id, created_at, status, payment_status,
           currency, subtotal_cents, item_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        order.id,
        order.reference,
        order.idempotencyKey,
        order.requestFingerprint,
        DEMO_CUSTOMER.id,
        order.createdAt,
        ORDER_STATUS,
        ORDER_PAYMENT_STATUS,
        ORDER_CURRENCY,
        order.subtotalCents,
        order.itemCount,
      );

    const insertItem = this.#database.prepare(
      `INSERT INTO order_items (
         order_id, line_number, product_id, product_name,
         unit_price_cents, quantity, line_total_cents
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    order.items.forEach((item, lineNumber) => {
      insertItem.run(
        order.id,
        lineNumber,
        item.productId,
        item.productName,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents,
      );
    });
  }

  private readOrder(orderId: string): CompletedOrder {
    const orderRow = this.#database
      .prepare(
        `SELECT
           id,
           reference,
           created_at AS createdAt,
           demo_customer_id AS demoCustomerId,
           status,
           payment_status AS paymentStatus,
           currency,
           subtotal_cents AS subtotalCents,
           item_count AS itemCount
         FROM orders
         WHERE id = ?`,
      )
      .get(orderId);
    if (orderRow === undefined) {
      throw new DataIntegrityError("The persisted order could not be read back.");
    }

    assertLiteral(orderRow, "demoCustomerId", DEMO_CUSTOMER.id);
    assertLiteral(orderRow, "status", ORDER_STATUS);
    assertLiteral(orderRow, "currency", ORDER_CURRENCY);

    const paymentStatus = readString(orderRow, "paymentStatus");
    if (!(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
      throw new DataIntegrityError("The stored paymentStatus value is invalid.");
    }

    const itemRows = this.#database
      .prepare(
        `SELECT
           product_id AS productId,
           product_name AS productName,
           unit_price_cents AS unitPriceCents,
           quantity,
           line_total_cents AS lineTotalCents
         FROM order_items
         WHERE order_id = ?
         ORDER BY line_number`,
      )
      .all(orderId) as unknown as DatabaseRow[];

    return {
      id: readString(orderRow, "id"),
      reference: readString(orderRow, "reference"),
      createdAt: readString(orderRow, "createdAt"),
      status: ORDER_STATUS,
      paymentStatus: paymentStatus as PaymentStatus,
      currency: ORDER_CURRENCY,
      subtotalCents: readInteger(orderRow, "subtotalCents"),
      itemCount: readInteger(orderRow, "itemCount"),
      demoCustomer: DEMO_CUSTOMER,
      items: itemRows.map(mapOrderItem),
    };
  }

  private rollback(cause: unknown): never {
    try {
      if (this.#database.isTransaction) {
        this.#database.exec("ROLLBACK");
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [cause, rollbackError],
        "The order transaction and its rollback both failed.",
        { cause: rollbackError },
      );
    }
    throw cause;
  }
}
